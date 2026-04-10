import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/generated/client';
import {
  OrderStatus,
  PaymentAttemptStatus,
  PaymentMethod,
  PaymentStatus,
  RefundStatus,
} from '@prisma/generated/enums';
import { createPrismaMock } from '@src/test-utils/prisma.mock';
import { PrismaService } from '@src/infra/prisma/prisma.service';
import { StripeService } from '@src/infra/stripe/stripe.service';
import { PaymentService } from './payment.service';

describe('PaymentService', () => {
  let service: PaymentService;
  let prisma: jest.Mocked<PrismaService>;
  let tx: jest.Mocked<PrismaService>;
  let stripeService: {
    createPaymentIntent: jest.Mock;
    retrievePaymentIntent: jest.Mock;
    cancelPaymentIntent: jest.Mock;
    createRefund: jest.Mock;
    constructWebhookEvent: jest.Mock;
  };

  const orgId = 'org-1';
  const orderId = 'order-1';
  const createdAt = new Date('2026-01-01T00:00:00.000Z');
  const updatedAt = new Date('2026-01-02T00:00:00.000Z');

  beforeEach(async () => {
    tx = createPrismaMock();
    prisma = createPrismaMock(tx);
    stripeService = {
      createPaymentIntent: jest.fn(),
      retrievePaymentIntent: jest.fn(),
      cancelPaymentIntent: jest.fn(),
      createRefund: jest.fn(),
      constructWebhookEvent: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: PrismaService, useValue: prisma },
        { provide: StripeService, useValue: stripeService },
      ],
    }).compile();

    service = module.get(PaymentService);
  });

  function makeAttempt(
    overrides: Record<string, any> = {},
  ): Record<string, any> {
    return {
      id: 'attempt-1',
      paymentId: 'pay-1',
      stripePaymentIntentId: 'pi_123',
      status: PaymentAttemptStatus.PENDING,
      clientSecret: 'secret_123',
      amountCents: 1950,
      currencyCode: 'CAD',
      lastFailure: null,
      createdAt,
      updatedAt,
      ...overrides,
    };
  }

  function makePayment(
    overrides: Record<string, any> = {},
    attempts: Array<Record<string, any>> = [],
  ): Record<string, any> {
    return {
      id: 'pay-1',
      organizationId: orgId,
      orderId,
      method: PaymentMethod.CARD,
      paymentStatus: PaymentStatus.UNPAID,
      refundStatus: RefundStatus.NONE,
      amountCents: 1950,
      currencyCode: 'CAD',
      stripeRefundId: null,
      paidAt: null,
      refundRequestedAt: null,
      refundedAt: null,
      refundFailedAt: null,
      refundReason: null,
      lastPaymentFailure: null,
      lastRefundFailure: null,
      createdAt,
      updatedAt,
      attempts,
      ...overrides,
    };
  }

  function makeOrder(
    status: OrderStatus,
    payment: Record<string, any> | null,
  ): Record<string, any> {
    return {
      id: orderId,
      organizationId: orgId,
      status,
      totalCents: 1950,
      createdAt,
      placedAt: status === OrderStatus.PENDING ? null : createdAt,
      cancelledAt: status === OrderStatus.CANCELLED ? createdAt : null,
      payment,
    };
  }

  it('reuses an active card attempt instead of creating a duplicate', async () => {
    const attempt = makeAttempt();
    const payment = makePayment({ paymentStatus: PaymentStatus.PENDING }, [
      attempt,
    ]);
    (tx.order.findFirst as jest.Mock).mockResolvedValue(
      makeOrder(OrderStatus.CONFIRMED, payment),
    );

    const result = await service.initiateCardPayment(orgId, orderId);

    expect(stripeService.createPaymentIntent).not.toHaveBeenCalled();
    expect(result).toEqual({
      paymentId: 'pay-1',
      attemptId: 'attempt-1',
      clientSecret: 'secret_123',
      paymentStatus: PaymentStatus.PENDING,
      attemptStatus: PaymentAttemptStatus.PENDING,
    });
  });

  it('creates a new attempt when the latest card attempt failed', async () => {
    const previousAttempt = makeAttempt({
      id: 'attempt-old',
      status: PaymentAttemptStatus.FAILED,
      lastFailure: 'Card declined',
    });
    const payment = makePayment(
      {
        paymentStatus: PaymentStatus.FAILED,
        lastPaymentFailure: 'Card declined',
      },
      [previousAttempt],
    );

    (tx.order.findFirst as jest.Mock).mockResolvedValue(
      makeOrder(OrderStatus.CONFIRMED, payment),
    );
    stripeService.createPaymentIntent.mockResolvedValue({
      id: 'pi_new',
      client_secret: 'secret_new',
    });
    (tx.paymentAttempt.create as jest.Mock).mockImplementation(({ data }) =>
      Promise.resolve({ ...makeAttempt(), ...data }),
    );
    (tx.payment.update as jest.Mock).mockResolvedValue(undefined);

    const result = await service.initiateCardPayment(orgId, orderId);

    expect(stripeService.createPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        amountCents: 1950,
        currencyCode: 'CAD',
        metadata: expect.objectContaining({
          orderId,
          organizationId: orgId,
          paymentId: 'pay-1',
        }),
      }),
    );
    expect(tx.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay-1' },
      data: {
        method: PaymentMethod.CARD,
        paymentStatus: PaymentStatus.PENDING,
        lastPaymentFailure: null,
      },
    });
    expect(result.clientSecret).toBe('secret_new');
  });

  it('rejects cash payment while a card payment is still pending', async () => {
    const payment = makePayment(
      {
        paymentStatus: PaymentStatus.PENDING,
      },
      [makeAttempt()],
    );
    (tx.order.findFirst as jest.Mock).mockResolvedValue(
      makeOrder(OrderStatus.CONFIRMED, payment),
    );

    await expect(service.markCashPaid(orgId, orderId)).rejects.toThrow(
      new BadRequestException(
        'Cannot mark cash paid while a card payment is still in progress',
      ),
    );
  });

  it('refunds cash payments and cancels confirmed orders', async () => {
    const payment = makePayment({
      method: PaymentMethod.CASH,
      paymentStatus: PaymentStatus.PAID,
      paidAt: createdAt,
    });
    const requestedPayment = makePayment({
      method: PaymentMethod.CASH,
      paymentStatus: PaymentStatus.PAID,
      refundStatus: RefundStatus.REQUESTED,
      refundRequestedAt: updatedAt,
      refundReason: 'Customer changed their mind',
    });
    const refundedPayment = makePayment({
      method: PaymentMethod.CASH,
      paymentStatus: PaymentStatus.PAID,
      refundStatus: RefundStatus.REFUNDED,
      refundRequestedAt: updatedAt,
      refundedAt: updatedAt,
      refundReason: 'Customer changed their mind',
    });

    (prisma.order.findFirst as jest.Mock).mockResolvedValue(
      makeOrder(OrderStatus.CONFIRMED, payment),
    );
    (tx.order.findFirst as jest.Mock).mockResolvedValue(
      makeOrder(OrderStatus.CONFIRMED, payment),
    );
    (tx.payment.findUnique as jest.Mock).mockResolvedValue(payment);
    (tx.payment.update as jest.Mock)
      .mockResolvedValueOnce(requestedPayment)
      .mockResolvedValueOnce(refundedPayment);
    (tx.order.update as jest.Mock).mockResolvedValue({});

    const result = await service.refundPayment(orgId, orderId, {
      refundReason: 'Customer changed their mind',
    });

    expect(tx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: OrderStatus.CANCELLED,
          cancelledAt: expect.any(Date),
        }),
      }),
    );
    expect(result.refundStatus).toBe(RefundStatus.REFUNDED);
    expect(result.refundReason).toBe('Customer changed their mind');
  });

  it('ignores duplicate webhook deliveries after the receipt already exists', async () => {
    (tx.stripeWebhookReceipt.create as jest.Mock).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
      }),
    );

    await service.handleWebhookPaymentIntent(
      'evt_1',
      'payment_intent.succeeded',
      {
        id: 'pi_123',
        status: 'succeeded',
        metadata: {},
      } as any,
    );

    expect(tx.paymentAttempt.findFirst).not.toHaveBeenCalled();
    expect(tx.stripeWebhookReceipt.update).not.toHaveBeenCalled();
  });
});
