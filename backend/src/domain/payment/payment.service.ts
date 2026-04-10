import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import Stripe from 'stripe';
import { type CurrentOrg } from '@src/common/decorators/current-org.decorator';
import { type AuditContext } from '@src/common/audit/audit-context';
import {
  getLocationScopeWhere,
  resolveOrganizationScope,
} from '@src/common/organization/location-scope';
import { PrismaService } from '@src/infra/prisma/prisma.service';
import { StripeService } from '@src/infra/stripe/stripe.service';
import {
  Prisma,
  type Order,
  type Payment,
  type PaymentAttempt,
} from '@prisma/generated/client';
import {
  AuditAction,
  AuditEntityType,
  OrderStatus,
  PaymentAttemptStatus,
  PaymentMethod,
  PaymentStatus,
  RefundStatus,
} from '@prisma/generated/enums';
import {
  CreateCardPaymentResponseDto,
  PaymentDto,
  RefundPaymentDto,
} from './payment.dto';
import { toPaymentDto } from './payment.utils';

const CARD_ACTIVE_ATTEMPT_STATUSES = new Set<PaymentAttemptStatus>([
  PaymentAttemptStatus.PENDING,
  PaymentAttemptStatus.REQUIRES_ACTION,
]);

const ACTIVE_REFUND_STATUSES = new Set<RefundStatus>([
  RefundStatus.REQUESTED,
  RefundStatus.PENDING,
]);

type PaymentWithAttempts = Payment & {
  attempts: PaymentAttempt[];
};

type OrderWithPayment = Order & {
  payment: PaymentWithAttempts | null;
};

type PaymentTransitionResult = {
  paymentStatus: PaymentStatus;
  attemptStatus: PaymentAttemptStatus;
  lastFailure: string | null;
  paidAt: Date | null;
};

type RefundTransitionResult = {
  refundStatus: RefundStatus;
  lastFailure: string | null;
  refundedAt: Date | null;
  refundFailedAt: Date | null;
};

type StripePaymentIntent = Awaited<
  ReturnType<StripeService['retrievePaymentIntent']>
>;

type StripeRefund = Awaited<ReturnType<StripeService['createRefund']>>;

@Injectable()
export class PaymentService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly stripeService: StripeService,
  ) {}

  async createPaymentForConfirmedOrderTx(
    tx: Prisma.TransactionClient,
    args: {
      orderId: string;
      organizationId: string;
      amountCents: number;
      orderCreatedAt: Date;
    },
    auditContext: AuditContext = {},
  ) {
    const existing = await tx.payment.findUnique({
      where: { orderId: args.orderId },
      include: {
        attempts: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (existing) {
      return existing;
    }

    const payment = await tx.payment.create({
      data: {
        organizationId: args.organizationId,
        orderId: args.orderId,
        paymentStatus: PaymentStatus.UNPAID,
        refundStatus: RefundStatus.NONE,
        amountCents: args.amountCents,
        currencyCode: 'CAD',
        createdAt: args.orderCreatedAt,
      },
      include: {
        attempts: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    await this.writePaymentAuditLogTx(
      tx,
      payment,
      AuditAction.PAYMENT_CREATED,
      null,
      {
        paymentStatus: payment.paymentStatus,
        refundStatus: payment.refundStatus,
        amountCents: payment.amountCents,
        currencyCode: payment.currencyCode,
      },
      auditContext,
    );

    return payment;
  }

  async ensureLegacyPaymentForOrderTx(
    tx: Prisma.TransactionClient | PrismaService,
    args: {
      orderId: string;
      organizationId: string;
      orderStatus: OrderStatus;
      amountCents: number;
      orderCreatedAt: Date;
      placedAt: Date | null;
    },
  ): Promise<PaymentWithAttempts | null> {
    const existing = await tx.payment.findUnique({
      where: { orderId: args.orderId },
      include: {
        attempts: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (existing) {
      return existing;
    }

    if (args.orderStatus === OrderStatus.PENDING) {
      return null;
    }

    if (args.orderStatus === OrderStatus.CANCELLED && !args.placedAt) {
      return null;
    }

    const isPaidOrder = args.orderStatus === OrderStatus.FULFILLED;
    return tx.payment.create({
      data: {
        organizationId: args.organizationId,
        orderId: args.orderId,
        paymentStatus: isPaidOrder ? PaymentStatus.PAID : PaymentStatus.UNPAID,
        refundStatus: RefundStatus.NONE,
        amountCents: args.amountCents,
        currencyCode: 'CAD',
        paidAt: isPaidOrder ? (args.placedAt ?? args.orderCreatedAt) : null,
        createdAt: args.orderCreatedAt,
      },
      include: {
        attempts: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async getPaymentByIdTx(
    tx: Prisma.TransactionClient | PrismaService,
    paymentId: string,
  ): Promise<PaymentWithAttempts> {
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: {
        attempts: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }

  async cancelActiveCardAttemptTx(
    tx: Prisma.TransactionClient,
    paymentId: string,
    auditContext: AuditContext = {},
  ): Promise<PaymentWithAttempts> {
    const payment = await this.getPaymentByIdTx(tx, paymentId);
    const attempt = this.getReusableAttempt(payment);

    if (!attempt) {
      return payment;
    }

    const paymentIntent = await this.cancelPaymentIntentForSync(
      attempt.stripePaymentIntentId,
    );

    await this.applyPaymentIntentStateTx(
      tx,
      payment,
      attempt,
      paymentIntent,
      auditContext,
    );

    return this.getPaymentByIdTx(tx, paymentId);
  }

  async deletePaymentForReopenTx(
    tx: Prisma.TransactionClient,
    paymentId: string,
    auditContext: AuditContext = {},
  ) {
    const payment = await this.getPaymentByIdTx(tx, paymentId);
    const attempt = this.getReusableAttempt(payment);

    if (attempt) {
      await this.cancelPaymentIntentForSync(attempt.stripePaymentIntentId);
    }

    const before = {
      method: payment.method,
      paymentStatus: payment.paymentStatus,
      refundStatus: payment.refundStatus,
      latestAttemptId: attempt?.id ?? null,
      latestAttemptStatus: attempt?.status ?? null,
      stripePaymentIntentId: attempt?.stripePaymentIntentId ?? null,
    };

    await tx.paymentAttempt.deleteMany({
      where: { paymentId: payment.id },
    });
    await tx.payment.delete({
      where: { id: payment.id },
    });

    await this.writePaymentAuditLogTx(
      tx,
      payment,
      AuditAction.PAYMENT_REOPEN_VOIDED,
      before,
      {
        deleted: true,
      },
      auditContext,
    );
  }

  async initiateCardPayment(
    organization: CurrentOrg | string,
    orderId: string,
    auditContext: AuditContext = {},
  ): Promise<CreateCardPaymentResponseDto> {
    const org = resolveOrganizationScope(organization);

    return this.prismaService.$transaction(async (tx) => {
      const order = await this.getOrderWithPaymentTx(tx, org, orderId);
      const payment =
        order.payment ??
        (await this.ensureLegacyPaymentForOrderTx(tx, {
          orderId: order.id,
          organizationId: order.organizationId,
          orderStatus: order.status,
          amountCents: order.totalCents,
          orderCreatedAt: order.createdAt,
          placedAt: order.placedAt,
        }));

      if (!payment || order.status !== OrderStatus.CONFIRMED) {
        throw new BadRequestException(
          'Only confirmed orders can accept payments',
        );
      }

      this.assertPaymentAcceptsCollection(payment);

      const reusableAttempt = this.getReusableAttempt(payment);
      if (reusableAttempt) {
        return {
          paymentId: payment.id,
          attemptId: reusableAttempt.id,
          clientSecret: reusableAttempt.clientSecret,
          paymentStatus: payment.paymentStatus,
          attemptStatus: reusableAttempt.status,
        };
      }

      const attemptId = randomUUID();
      const paymentIntent = await this.stripeService.createPaymentIntent({
        amountCents: payment.amountCents,
        currencyCode: payment.currencyCode,
        metadata: {
          orderId: order.id,
          organizationId: order.organizationId,
          paymentId: payment.id,
          paymentAttemptId: attemptId,
        },
        idempotencyKey: `payment-attempt:${payment.id}:${attemptId}`,
      });

      if (!paymentIntent.client_secret) {
        throw new BadRequestException(
          'Stripe did not return a client secret for this payment attempt',
        );
      }

      const attempt = await tx.paymentAttempt.create({
        data: {
          id: attemptId,
          paymentId: payment.id,
          stripePaymentIntentId: paymentIntent.id,
          status: PaymentAttemptStatus.PENDING,
          clientSecret: paymentIntent.client_secret,
          amountCents: payment.amountCents,
          currencyCode: payment.currencyCode,
        },
      });

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          method: PaymentMethod.CARD,
          paymentStatus: PaymentStatus.PENDING,
          lastPaymentFailure: null,
        },
      });

      await this.writePaymentAuditLogTx(
        tx,
        payment,
        AuditAction.PAYMENT_ATTEMPT_STARTED,
        {
          paymentStatus: payment.paymentStatus,
          refundStatus: payment.refundStatus,
        },
        {
          paymentStatus: PaymentStatus.PENDING,
          refundStatus: payment.refundStatus,
          attemptId: attempt.id,
          stripePaymentIntentId: attempt.stripePaymentIntentId,
        },
        auditContext,
      );

      return {
        paymentId: payment.id,
        attemptId: attempt.id,
        clientSecret: attempt.clientSecret,
        paymentStatus: PaymentStatus.PENDING,
        attemptStatus: attempt.status,
      };
    });
  }

  async confirmCardPayment(
    organization: CurrentOrg | string,
    orderId: string,
    auditContext: AuditContext = {},
  ): Promise<PaymentDto> {
    const org = resolveOrganizationScope(organization);
    const order = await this.getOrderWithPaymentTx(
      this.prismaService,
      org,
      orderId,
    );
    const payment =
      order.payment ??
      (await this.ensureLegacyPaymentForOrderTx(this.prismaService, {
        orderId: order.id,
        organizationId: order.organizationId,
        orderStatus: order.status,
        amountCents: order.totalCents,
        orderCreatedAt: order.createdAt,
        placedAt: order.placedAt,
      }));

    if (!payment) {
      throw new NotFoundException('Payment not found for order');
    }

    const latestAttempt = payment.attempts[0];
    if (!latestAttempt) {
      throw new BadRequestException('No card payment attempt exists for order');
    }

    const paymentIntent = await this.stripeService.retrievePaymentIntent(
      latestAttempt.stripePaymentIntentId,
    );

    return this.prismaService.$transaction(async (tx) => {
      const freshPayment = await this.getPaymentByIdTx(tx, payment.id);
      const freshAttempt =
        freshPayment.attempts.find(
          (attempt) => attempt.id === latestAttempt.id,
        ) ?? freshPayment.attempts[0];

      if (!freshAttempt) {
        throw new NotFoundException('Payment attempt not found');
      }

      return this.applyPaymentIntentStateTx(
        tx,
        freshPayment,
        freshAttempt,
        paymentIntent,
        auditContext,
      );
    });
  }

  async markCashPaid(
    organization: CurrentOrg | string,
    orderId: string,
    auditContext: AuditContext = {},
  ): Promise<PaymentDto> {
    const org = resolveOrganizationScope(organization);

    return this.prismaService.$transaction(async (tx) => {
      const order = await this.getOrderWithPaymentTx(tx, org, orderId);
      const payment =
        order.payment ??
        (await this.ensureLegacyPaymentForOrderTx(tx, {
          orderId: order.id,
          organizationId: order.organizationId,
          orderStatus: order.status,
          amountCents: order.totalCents,
          orderCreatedAt: order.createdAt,
          placedAt: order.placedAt,
        }));

      if (!payment || order.status !== OrderStatus.CONFIRMED) {
        throw new BadRequestException(
          'Only confirmed orders can be marked as paid',
        );
      }

      this.assertRefundInactive(payment);

      if (payment.paymentStatus === PaymentStatus.PAID) {
        throw new ConflictException('Order payment has already been completed');
      }

      if (payment.paymentStatus === PaymentStatus.PENDING) {
        throw new BadRequestException(
          'Cannot mark cash paid while a card payment is still in progress',
        );
      }

      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: {
          method: PaymentMethod.CASH,
          paymentStatus: PaymentStatus.PAID,
          paidAt: payment.paidAt ?? new Date(),
          lastPaymentFailure: null,
        },
        include: {
          attempts: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      await this.writePaymentAuditLogTx(
        tx,
        payment,
        AuditAction.PAYMENT_PAID,
        {
          paymentStatus: payment.paymentStatus,
          refundStatus: payment.refundStatus,
          method: payment.method,
        },
        {
          paymentStatus: updated.paymentStatus,
          refundStatus: updated.refundStatus,
          method: updated.method,
        },
        auditContext,
      );

      return toPaymentDto(updated);
    });
  }

  async refundPayment(
    organization: CurrentOrg | string,
    orderId: string,
    data: RefundPaymentDto,
    auditContext: AuditContext = {},
  ): Promise<PaymentDto> {
    const org = resolveOrganizationScope(organization);
    const order = await this.getOrderWithPaymentTx(
      this.prismaService,
      org,
      orderId,
    );
    const payment =
      order.payment ??
      (await this.ensureLegacyPaymentForOrderTx(this.prismaService, {
        orderId: order.id,
        organizationId: order.organizationId,
        orderStatus: order.status,
        amountCents: order.totalCents,
        orderCreatedAt: order.createdAt,
        placedAt: order.placedAt,
      }));

    if (!payment) {
      throw new NotFoundException('Payment not found for order');
    }

    this.assertPaymentCanRefund(order, payment);

    if (payment.method === PaymentMethod.CASH) {
      return this.prismaService.$transaction(async (tx) => {
        const refreshedOrder = await this.getOrderWithPaymentTx(
          tx,
          org,
          orderId,
        );
        const refreshedPayment = await this.getPaymentByIdTx(tx, payment.id);

        await this.markRefundRequestedTx(
          tx,
          refreshedPayment,
          data.refundReason,
          auditContext,
        );

        const refunded = await tx.payment.update({
          where: { id: refreshedPayment.id },
          data: {
            refundStatus: RefundStatus.REFUNDED,
            refundedAt: new Date(),
            lastRefundFailure: null,
          },
          include: {
            attempts: {
              orderBy: { createdAt: 'desc' },
            },
          },
        });

        if (refreshedOrder.status === OrderStatus.CONFIRMED) {
          await tx.order.update({
            where: {
              id_organizationId: {
                id: refreshedOrder.id,
                organizationId: refreshedOrder.organizationId,
              },
            },
            data: {
              status: OrderStatus.CANCELLED,
              cancelledAt: new Date(),
            },
          });
        }

        await this.writePaymentAuditLogTx(
          tx,
          refreshedPayment,
          AuditAction.PAYMENT_REFUNDED,
          {
            refundStatus: RefundStatus.REQUESTED,
          },
          {
            refundStatus: refunded.refundStatus,
          },
          auditContext,
        );

        return toPaymentDto(refunded);
      });
    }

    const successfulAttempt = payment.attempts.find(
      (attempt) => attempt.status === PaymentAttemptStatus.SUCCEEDED,
    );
    if (!successfulAttempt) {
      throw new BadRequestException(
        'Card refunds require a successful payment attempt',
      );
    }

    await this.prismaService.$transaction(async (tx) => {
      const refreshedPayment = await this.getPaymentByIdTx(tx, payment.id);
      await this.markRefundRequestedTx(
        tx,
        refreshedPayment,
        data.refundReason,
        auditContext,
      );
    });

    let refund: StripeRefund;
    try {
      refund = await this.stripeService.createRefund({
        paymentIntentId: successfulAttempt.stripePaymentIntentId,
        metadata: {
          orderId: order.id,
          organizationId: order.organizationId,
          paymentId: payment.id,
        },
        idempotencyKey: `refund:${payment.id}`,
      });
    } catch (error) {
      const failureMessage = this.getStripeFailureMessage(
        error,
        'Unable to create Stripe refund',
      );

      return this.prismaService.$transaction(async (tx) => {
        const failedPayment = await this.getPaymentByIdTx(tx, payment.id);
        const updated = await tx.payment.update({
          where: { id: failedPayment.id },
          data: {
            refundStatus: RefundStatus.FAILED,
            lastRefundFailure: failureMessage,
            refundFailedAt: new Date(),
          },
          include: {
            attempts: {
              orderBy: { createdAt: 'desc' },
            },
          },
        });

        await this.writePaymentAuditLogTx(
          tx,
          failedPayment,
          AuditAction.PAYMENT_REFUND_FAILED,
          {
            refundStatus: failedPayment.refundStatus,
          },
          {
            refundStatus: updated.refundStatus,
            lastRefundFailure: updated.lastRefundFailure,
          },
          auditContext,
        );

        return toPaymentDto(updated);
      });
    }

    return this.prismaService.$transaction(async (tx) => {
      const refreshedOrder = await this.getOrderWithPaymentTx(tx, org, orderId);
      const refreshedPayment = await this.getPaymentByIdTx(tx, payment.id);

      return this.applyRefundStateTx(
        tx,
        refreshedOrder,
        refreshedPayment,
        refund,
        auditContext,
      );
    });
  }

  async getPaymentByOrderId(
    organization: CurrentOrg | string,
    orderId: string,
  ): Promise<PaymentDto> {
    const org = resolveOrganizationScope(organization);
    const order = await this.getOrderWithPaymentTx(
      this.prismaService,
      org,
      orderId,
    );
    const payment =
      order.payment ??
      (await this.ensureLegacyPaymentForOrderTx(this.prismaService, {
        orderId: order.id,
        organizationId: order.organizationId,
        orderStatus: order.status,
        amountCents: order.totalCents,
        orderCreatedAt: order.createdAt,
        placedAt: order.placedAt,
      }));

    if (!payment) {
      throw new NotFoundException('Payment not found for order');
    }

    return toPaymentDto(payment);
  }

  async handleWebhookPaymentIntent(
    stripeEventId: string,
    eventType: string,
    paymentIntent: StripePaymentIntent,
  ) {
    await this.prismaService.$transaction(async (tx) => {
      const shouldProcess = await this.createWebhookReceiptTx(
        tx,
        stripeEventId,
        eventType,
      );

      if (!shouldProcess) {
        return;
      }

      const metadataAttemptId =
        paymentIntent.metadata?.paymentAttemptId || null;
      const attempt = await tx.paymentAttempt.findFirst({
        where: {
          OR: [
            { stripePaymentIntentId: paymentIntent.id },
            ...(metadataAttemptId ? [{ id: metadataAttemptId }] : []),
          ],
        },
        include: {
          payment: {
            include: {
              attempts: {
                orderBy: { createdAt: 'desc' },
              },
            },
          },
        },
      });

      if (!attempt) {
        await this.markWebhookReceiptProcessedTx(tx, stripeEventId);
        return;
      }

      const payment = await this.getPaymentByIdTx(tx, attempt.payment.id);
      const freshAttempt =
        payment.attempts.find((entry) => entry.id === attempt.id) ??
        payment.attempts[0];

      if (!freshAttempt) {
        await this.markWebhookReceiptProcessedTx(tx, stripeEventId);
        return;
      }

      await this.applyPaymentIntentStateTx(
        tx,
        payment,
        freshAttempt,
        paymentIntent,
      );
      await this.markWebhookReceiptProcessedTx(tx, stripeEventId);
    });
  }

  async handleWebhookRefund(
    stripeEventId: string,
    eventType: string,
    refund: StripeRefund,
  ) {
    await this.prismaService.$transaction(async (tx) => {
      const shouldProcess = await this.createWebhookReceiptTx(
        tx,
        stripeEventId,
        eventType,
      );

      if (!shouldProcess) {
        return;
      }

      const metadataPaymentId = refund.metadata?.paymentId || null;
      const payment = await tx.payment.findFirst({
        where: {
          OR: [
            { stripeRefundId: refund.id },
            ...(metadataPaymentId ? [{ id: metadataPaymentId }] : []),
          ],
        },
        include: {
          attempts: {
            orderBy: { createdAt: 'desc' },
          },
          order: true,
        },
      });

      if (!payment) {
        await this.markWebhookReceiptProcessedTx(tx, stripeEventId);
        return;
      }

      await this.applyRefundStateTx(tx, payment.order, payment, refund);
      await this.markWebhookReceiptProcessedTx(tx, stripeEventId);
    });
  }

  private async markRefundRequestedTx(
    tx: Prisma.TransactionClient,
    payment: PaymentWithAttempts,
    refundReason: string,
    auditContext: AuditContext,
  ) {
    const requested = await tx.payment.update({
      where: { id: payment.id },
      data: {
        refundStatus: RefundStatus.REQUESTED,
        refundRequestedAt: new Date(),
        refundReason,
        lastRefundFailure: null,
        refundFailedAt: null,
      },
      include: {
        attempts: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (payment.refundStatus !== RefundStatus.REQUESTED) {
      await this.writePaymentAuditLogTx(
        tx,
        payment,
        AuditAction.PAYMENT_REFUND_REQUESTED,
        {
          refundStatus: payment.refundStatus,
        },
        {
          refundStatus: requested.refundStatus,
          refundReason,
        },
        auditContext,
      );
    }

    return requested;
  }

  private async getOrderWithPaymentTx(
    tx: Prisma.TransactionClient | PrismaService,
    organization: CurrentOrg,
    orderId: string,
  ): Promise<OrderWithPayment> {
    const order = await tx.order.findFirst({
      where: {
        id: orderId,
        organizationId: organization.organizationId,
        ...getLocationScopeWhere(organization),
      },
      include: {
        payment: {
          include: {
            attempts: {
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found for organization');
    }

    return order as OrderWithPayment;
  }

  private assertPaymentAcceptsCollection(payment: PaymentWithAttempts) {
    if (payment.refundStatus === RefundStatus.REFUNDED) {
      throw new ConflictException('Refunded orders cannot accept new payments');
    }

    this.assertRefundInactive(payment);

    if (payment.paymentStatus === PaymentStatus.PAID) {
      throw new ConflictException('Order payment has already been completed');
    }
  }

  private assertRefundInactive(payment: PaymentWithAttempts) {
    if (ACTIVE_REFUND_STATUSES.has(payment.refundStatus)) {
      throw new BadRequestException(
        'Refund processing is already in progress for this order',
      );
    }
  }

  private assertPaymentCanRefund(
    order: OrderWithPayment,
    payment: PaymentWithAttempts,
  ) {
    if (
      order.status !== OrderStatus.CONFIRMED &&
      order.status !== OrderStatus.FULFILLED
    ) {
      throw new BadRequestException(
        'Only confirmed or fulfilled orders can be refunded',
      );
    }

    if (payment.paymentStatus !== PaymentStatus.PAID) {
      throw new BadRequestException('Only paid orders can be refunded');
    }

    if (payment.refundStatus === RefundStatus.REFUNDED) {
      throw new ConflictException('Order payment has already been refunded');
    }

    if (ACTIVE_REFUND_STATUSES.has(payment.refundStatus)) {
      throw new ConflictException('A refund is already in progress');
    }
  }

  private getReusableAttempt(payment: PaymentWithAttempts) {
    const latestAttempt = payment.attempts[0];
    if (!latestAttempt) {
      return null;
    }

    if (
      payment.paymentStatus === PaymentStatus.PENDING &&
      CARD_ACTIVE_ATTEMPT_STATUSES.has(latestAttempt.status)
    ) {
      return latestAttempt;
    }

    return null;
  }

  private async cancelPaymentIntentForSync(paymentIntentId: string) {
    try {
      return await this.stripeService.cancelPaymentIntent(paymentIntentId);
    } catch {
      return this.stripeService.retrievePaymentIntent(paymentIntentId);
    }
  }

  private async applyPaymentIntentStateTx(
    tx: Prisma.TransactionClient,
    payment: PaymentWithAttempts,
    attempt: PaymentAttempt,
    paymentIntent: StripePaymentIntent,
    auditContext: AuditContext = {},
  ): Promise<PaymentDto> {
    const next = this.mapPaymentIntentState(paymentIntent, payment);
    const paymentChanged =
      payment.paymentStatus !== next.paymentStatus ||
      payment.lastPaymentFailure !== next.lastFailure ||
      payment.paidAt?.toISOString() !== next.paidAt?.toISOString() ||
      payment.method !== PaymentMethod.CARD;
    const attemptChanged =
      attempt.status !== next.attemptStatus ||
      attempt.lastFailure !== next.lastFailure;

    if (!paymentChanged && !attemptChanged) {
      return toPaymentDto(payment);
    }

    if (attemptChanged) {
      await tx.paymentAttempt.update({
        where: { id: attempt.id },
        data: {
          status: next.attemptStatus,
          lastFailure: next.lastFailure,
        },
      });
    }

    const updatedPayment = await tx.payment.update({
      where: { id: payment.id },
      data: {
        method: PaymentMethod.CARD,
        paymentStatus: next.paymentStatus,
        lastPaymentFailure: next.lastFailure,
        paidAt: next.paidAt,
      },
      include: {
        attempts: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (payment.paymentStatus !== updatedPayment.paymentStatus) {
      const action =
        updatedPayment.paymentStatus === PaymentStatus.PAID
          ? AuditAction.PAYMENT_PAID
          : updatedPayment.paymentStatus === PaymentStatus.FAILED
            ? AuditAction.PAYMENT_FAILED
            : null;

      if (action) {
        await this.writePaymentAuditLogTx(
          tx,
          payment,
          action,
          {
            paymentStatus: payment.paymentStatus,
            refundStatus: payment.refundStatus,
          },
          {
            paymentStatus: updatedPayment.paymentStatus,
            refundStatus: updatedPayment.refundStatus,
            lastPaymentFailure: updatedPayment.lastPaymentFailure,
          },
          auditContext,
        );
      }
    }

    return toPaymentDto(updatedPayment);
  }

  private async applyRefundStateTx(
    tx: Prisma.TransactionClient,
    order: Order,
    payment: PaymentWithAttempts,
    refund: StripeRefund,
    auditContext: AuditContext = {},
  ): Promise<PaymentDto> {
    const next = this.mapRefundState(refund, payment);
    const paymentChanged =
      payment.refundStatus !== next.refundStatus ||
      payment.lastRefundFailure !== next.lastFailure ||
      payment.refundedAt?.toISOString() !== next.refundedAt?.toISOString() ||
      payment.refundFailedAt?.toISOString() !==
        next.refundFailedAt?.toISOString() ||
      payment.stripeRefundId !== refund.id;

    let updatedPayment = payment;
    if (paymentChanged) {
      updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          refundStatus: next.refundStatus,
          stripeRefundId: refund.id,
          refundedAt: next.refundedAt,
          refundFailedAt: next.refundFailedAt,
          lastRefundFailure: next.lastFailure,
        },
        include: {
          attempts: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });
    }

    if (
      updatedPayment.refundStatus === RefundStatus.REFUNDED &&
      order.status === OrderStatus.CONFIRMED
    ) {
      await tx.order.update({
        where: {
          id_organizationId: {
            id: order.id,
            organizationId: order.organizationId,
          },
        },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledAt: new Date(),
        },
      });
    }

    if (
      payment.refundStatus !== updatedPayment.refundStatus &&
      updatedPayment.refundStatus === RefundStatus.REFUNDED
    ) {
      await this.writePaymentAuditLogTx(
        tx,
        payment,
        AuditAction.PAYMENT_REFUNDED,
        {
          refundStatus: payment.refundStatus,
        },
        {
          refundStatus: updatedPayment.refundStatus,
        },
        auditContext,
      );
    }

    if (
      payment.refundStatus !== updatedPayment.refundStatus &&
      updatedPayment.refundStatus === RefundStatus.FAILED
    ) {
      await this.writePaymentAuditLogTx(
        tx,
        payment,
        AuditAction.PAYMENT_REFUND_FAILED,
        {
          refundStatus: payment.refundStatus,
        },
        {
          refundStatus: updatedPayment.refundStatus,
          lastRefundFailure: updatedPayment.lastRefundFailure,
        },
        auditContext,
      );
    }

    return toPaymentDto(updatedPayment);
  }

  private mapPaymentIntentState(
    paymentIntent: StripePaymentIntent,
    payment: Payment,
  ): PaymentTransitionResult {
    switch (paymentIntent.status) {
      case 'succeeded':
        return {
          paymentStatus: PaymentStatus.PAID,
          attemptStatus: PaymentAttemptStatus.SUCCEEDED,
          lastFailure: null,
          paidAt: payment.paidAt ?? new Date(),
        };
      case 'processing':
        return {
          paymentStatus: PaymentStatus.PENDING,
          attemptStatus: PaymentAttemptStatus.PENDING,
          lastFailure: null,
          paidAt: payment.paidAt ?? null,
        };
      case 'requires_action':
      case 'requires_confirmation':
        return {
          paymentStatus: PaymentStatus.PENDING,
          attemptStatus: PaymentAttemptStatus.REQUIRES_ACTION,
          lastFailure: null,
          paidAt: payment.paidAt ?? null,
        };
      case 'requires_payment_method':
        return {
          paymentStatus: PaymentStatus.FAILED,
          attemptStatus: PaymentAttemptStatus.FAILED,
          lastFailure:
            paymentIntent.last_payment_error?.message ??
            'Payment requires a new payment method',
          paidAt: null,
        };
      case 'canceled':
        return {
          paymentStatus: PaymentStatus.FAILED,
          attemptStatus: PaymentAttemptStatus.CANCELED,
          lastFailure:
            paymentIntent.cancellation_reason ?? 'Payment attempt was canceled',
          paidAt: null,
        };
      default:
        return {
          paymentStatus: PaymentStatus.PENDING,
          attemptStatus: PaymentAttemptStatus.PENDING,
          lastFailure: null,
          paidAt: payment.paidAt ?? null,
        };
    }
  }

  private mapRefundState(
    refund: StripeRefund,
    payment: Payment,
  ): RefundTransitionResult {
    switch (refund.status) {
      case 'succeeded':
        return {
          refundStatus: RefundStatus.REFUNDED,
          lastFailure: null,
          refundedAt: payment.refundedAt ?? new Date(),
          refundFailedAt: null,
        };
      case 'failed':
      case 'canceled':
        return {
          refundStatus: RefundStatus.FAILED,
          lastFailure:
            refund.failure_reason ??
            (refund.status === 'canceled'
              ? 'Refund was canceled'
              : 'Refund failed'),
          refundedAt: null,
          refundFailedAt: new Date(),
        };
      default:
        return {
          refundStatus: RefundStatus.PENDING,
          lastFailure: null,
          refundedAt: null,
          refundFailedAt: null,
        };
    }
  }

  private getStripeFailureMessage(error: unknown, fallback: string) {
    if (error instanceof Stripe.errors.StripeError && error.message) {
      return error.message;
    }

    if (error instanceof Error && error.message) {
      return error.message;
    }

    return fallback;
  }

  private async createWebhookReceiptTx(
    tx: Prisma.TransactionClient,
    stripeEventId: string,
    eventType: string,
  ) {
    try {
      await tx.stripeWebhookReceipt.create({
        data: {
          stripeEventId,
          eventType,
        },
      });
      return true;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return false;
      }

      throw error;
    }
  }

  private async markWebhookReceiptProcessedTx(
    tx: Prisma.TransactionClient,
    stripeEventId: string,
  ) {
    await tx.stripeWebhookReceipt.update({
      where: { stripeEventId },
      data: {
        processedAt: new Date(),
      },
    });
  }

  private async writePaymentAuditLogTx(
    tx: Prisma.TransactionClient,
    payment: Pick<Payment, 'id' | 'organizationId'>,
    action: AuditAction,
    beforeJson: Prisma.InputJsonValue | null,
    afterJson: Prisma.InputJsonValue | null,
    context: AuditContext,
  ) {
    await tx.auditLog.create({
      data: {
        organizationId: payment.organizationId,
        actorUserId: context.actorUserId ?? null,
        entityType: AuditEntityType.PAYMENT,
        entityId: payment.id,
        action,
        beforeJson: beforeJson ?? Prisma.NullableJsonNullValueInput.JsonNull,
        afterJson: afterJson ?? Prisma.NullableJsonNullValueInput.JsonNull,
        requestId: context.requestId ?? null,
        ip: context.ip ?? null,
        userAgent: context.userAgent ?? null,
      },
    });
  }
}
