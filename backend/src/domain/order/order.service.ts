import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type CurrentOrg } from '@src/common/decorators/current-org.decorator';
import { type AuditContext } from '@src/common/audit/audit-context';
import {
  ensureLocationAccessible,
  getLocationScopeWhere,
  hasRestrictedLocations,
  resolveOrganizationScope,
} from '@src/common/organization/location-scope';
import {
  CreateOrderDto,
  CreateOrderItemDto,
  GetOrderQueryDto,
  GetOrdersQueryDto,
  OrderItemDto,
  TransitionStatusBodyDto,
  UpdateOrderDto,
} from './order.dto';
import { PaymentService } from '@src/domain/payment/payment.service';
import { toPaymentSummaryDto } from '@src/domain/payment/payment.utils';
import { PrismaService } from '@src/infra/prisma/prisma.service';
import { Payment, Prisma } from '@prisma/generated/client';
import {
  OrderStatus,
  PaymentStatus,
  RefundStatus,
} from '@prisma/generated/enums';

const ORDER_CUSTOMER_SELECT = {
  id: true,
  name: true,
  email: true,
} as const;

const ORDER_LOCATION_SELECT = {
  id: true,
  name: true,
  addressLine1: true,
  city: true,
  stateProvince: true,
  postalCode: true,
  countryCode: true,
} as const;

const ACTIVE_REFUND_STATUSES = new Set<RefundStatus>([
  RefundStatus.REQUESTED,
  RefundStatus.PENDING,
]);

@Injectable()
export class OrderService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly paymentService: PaymentService,
  ) {}

  async createOrder(organization: CurrentOrg | string, data: CreateOrderDto) {
    const org = resolveOrganizationScope(organization);
    const { orderItems, customerId, locationId } = data;

    if (!orderItems?.length) {
      throw new BadRequestException('Order must contain at least one item');
    }

    if (hasRestrictedLocations(org)) {
      ensureLocationAccessible(org, locationId, {
        allowUnspecified: false,
        missingMessage:
          'A location is required when creating orders for a scoped membership',
      });
    }

    return this.prismaService.$transaction(async (tx) => {
      if (customerId) {
        const ok = await tx.customer.findFirst({
          where: { id: customerId, organizationId: org.organizationId },
          select: { id: true },
        });
        if (!ok) {
          throw new BadRequestException('Invalid customer for organization');
        }
      }

      if (locationId) {
        const ok = await tx.location.findFirst({
          where: {
            organizationId: org.organizationId,
            ...(hasRestrictedLocations(org)
              ? {
                  AND: [{ id: locationId }, getLocationScopeWhere(org, 'id')],
                }
              : { id: locationId }),
          },
          select: { id: true },
        });
        if (!ok) {
          throw new BadRequestException('Invalid location for organization');
        }
      }

      const productIds = [...new Set(orderItems.map((item) => item.productId))];
      const products = await tx.product.findMany({
        where: {
          id: { in: productIds },
          organizationId: org.organizationId,
          active: true,
        },
        select: { id: true, name: true, sku: true, priceCents: true },
      });

      const byId = new Map(products.map((product) => [product.id, product]));
      if (products.length !== productIds.length) {
        throw new BadRequestException(
          'One or more products are invalid or inactive for this organization',
        );
      }

      const computedLineItems: Array<Omit<OrderItemDto, 'orderId' | 'id'>> = [];
      const totals = {
        subtotalCents: 0,
        taxCents: 0,
        discountCents: 0,
        totalCents: 0,
      };

      for (const raw of orderItems) {
        const discountCents = raw.discountCents ?? 0;
        const taxCents = raw.taxCents ?? 0;
        const qty = raw.qty ?? 0;

        if (qty <= 0) {
          throw new BadRequestException('Item qty must be > 0');
        }

        if (discountCents < 0 || taxCents < 0) {
          throw new BadRequestException('Cents values must be non-negative');
        }

        const product = byId.get(raw.productId);
        if (!product) {
          throw new BadRequestException(
            'One or more products are invalid or inactive for this organization',
          );
        }

        const lineSubtotalCents = qty * product.priceCents;
        if (discountCents > lineSubtotalCents) {
          throw new BadRequestException('Discount cannot exceed line subtotal');
        }

        const lineTotalCents = lineSubtotalCents - discountCents + taxCents;

        computedLineItems.push({
          organizationId: org.organizationId,
          productId: raw.productId,
          productName: product.name,
          sku: product.sku ?? undefined,
          qty,
          unitPriceCents: product.priceCents,
          lineSubtotalCents,
          discountCents,
          taxCents,
          lineTotalCents,
        });

        totals.subtotalCents += lineSubtotalCents;
        totals.taxCents += taxCents;
        totals.discountCents += discountCents;
        totals.totalCents += lineTotalCents;
      }

      if (orderItems.length > 20) {
        const order = await tx.order.create({
          data: {
            ...totals,
            customerId,
            locationId,
            organizationId: org.organizationId,
            status: OrderStatus.PENDING,
          },
        });

        const createdItems = await tx.orderItem.createManyAndReturn({
          data: computedLineItems.map((item) => ({
            ...item,
            orderId: order.id,
          })),
        });

        return this.attachPaymentSummary({
          ...order,
          items: createdItems,
        });
      }

      const order = await tx.order.create({
        data: {
          ...totals,
          customerId,
          locationId,
          organizationId: org.organizationId,
          status: OrderStatus.PENDING,
          items: {
            create: computedLineItems.map((item) => ({
              ...item,
              organizationId: undefined,
            })),
          },
        },
        include: { items: true },
      });

      return this.attachPaymentSummary(order);
    });
  }

  async transitionStatus(
    organization: CurrentOrg | string,
    orderId: string,
    { toStatus }: TransitionStatusBodyDto,
    auditContext: AuditContext = {},
  ) {
    const org = resolveOrganizationScope(organization);

    const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
      PENDING: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      CONFIRMED: [OrderStatus.FULFILLED, OrderStatus.CANCELLED],
      CANCELLED: [OrderStatus.PENDING],
      FULFILLED: [],
    };

    return this.prismaService.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: {
          id: orderId,
          organizationId: org.organizationId,
          ...getLocationScopeWhere(org),
        },
        include: {
          payment: true,
        },
      });

      if (!order) {
        throw new NotFoundException('Order not found for organization');
      }

      if (!allowedTransitions[order.status].includes(toStatus)) {
        throw new BadRequestException(
          `Cannot transition from ${order.status} to ${toStatus}`,
        );
      }

      switch (toStatus) {
        case OrderStatus.CONFIRMED: {
          const placedAt = order.placedAt ?? new Date();

          await tx.order.update({
            where: {
              id_organizationId: {
                id: order.id,
                organizationId: order.organizationId,
              },
            },
            data: {
              status: OrderStatus.CONFIRMED,
              placedAt,
              cancelledAt: null,
            },
          });

          await this.paymentService.createPaymentForConfirmedOrderTx(
            tx,
            {
              orderId: order.id,
              organizationId: order.organizationId,
              amountCents: order.totalCents,
              orderCreatedAt: order.createdAt,
            },
            auditContext,
          );
          break;
        }
        case OrderStatus.FULFILLED: {
          const payment = await this.ensureTransitionPaymentTx(tx, order);

          if (
            !payment ||
            payment.paymentStatus !== PaymentStatus.PAID ||
            payment.refundStatus !== RefundStatus.NONE
          ) {
            throw new BadRequestException(
              'Confirmed orders can only be fulfilled after payment has been completed',
            );
          }

          await tx.order.update({
            where: {
              id_organizationId: {
                id: order.id,
                organizationId: order.organizationId,
              },
            },
            data: { status: OrderStatus.FULFILLED },
          });
          break;
        }
        case OrderStatus.CANCELLED: {
          if (order.status === OrderStatus.CONFIRMED) {
            const payment = await this.ensureTransitionPaymentTx(tx, order);

            if (payment) {
              if (
                payment.paymentStatus === PaymentStatus.PAID ||
                payment.refundStatus === RefundStatus.REFUNDED
              ) {
                throw new BadRequestException(
                  'Paid orders must be refunded instead of cancelled',
                );
              }

              if (ACTIVE_REFUND_STATUSES.has(payment.refundStatus)) {
                throw new BadRequestException(
                  'Orders with refunds in progress cannot be cancelled',
                );
              }

              await this.paymentService.cancelActiveCardAttemptTx(
                tx,
                payment.id,
                auditContext,
              );
            }
          }

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
          break;
        }
        case OrderStatus.PENDING: {
          const payment = await this.ensureTransitionPaymentTx(tx, order);

          if (payment) {
            if (
              payment.paymentStatus === PaymentStatus.PAID ||
              payment.refundStatus === RefundStatus.REFUNDED
            ) {
              throw new BadRequestException(
                'Paid or refunded orders cannot be reopened',
              );
            }

            if (ACTIVE_REFUND_STATUSES.has(payment.refundStatus)) {
              throw new BadRequestException(
                'Orders with refunds in progress cannot be reopened',
              );
            }

            await this.paymentService.deletePaymentForReopenTx(
              tx,
              payment.id,
              auditContext,
            );
          }

          await tx.order.update({
            where: {
              id_organizationId: {
                id: order.id,
                organizationId: order.organizationId,
              },
            },
            data: {
              status: OrderStatus.PENDING,
              placedAt: null,
              cancelledAt: null,
            },
          });
          break;
        }
        default:
          throw new BadRequestException('Unknown value for status update');
      }

      const updatedOrder = await tx.order.findFirst({
        where: {
          id: orderId,
          organizationId: org.organizationId,
          ...getLocationScopeWhere(org),
        },
        include: {
          customer: { select: ORDER_CUSTOMER_SELECT },
          location: { select: ORDER_LOCATION_SELECT },
          payment: true,
        },
      });

      if (!updatedOrder) {
        throw new NotFoundException('Order not found for organization');
      }

      return this.attachPaymentSummary(updatedOrder);
    });
  }

  async getOrders(organization: CurrentOrg | string, query: GetOrdersQueryDto) {
    const org = resolveOrganizationScope(organization);
    const { withItems, status, search, locationId, ...paginationQuery } = query;

    if (locationId) {
      ensureLocationAccessible(org, locationId, {
        allowUnspecified: false,
      });
    }

    const where: Prisma.OrderWhereInput = {
      organizationId: org.organizationId,
      ...getLocationScopeWhere(org),
    };

    if (status) {
      where.status = status;
    }

    if (locationId) {
      where.locationId = locationId;
    }

    if (search) {
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { customer: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [{ data, total, nextCursor }, distinctLocations] = await Promise.all([
      this.prismaService.paginateMany(
        this.prismaService.order,
        {
          where,
          include: {
            customer: { select: ORDER_CUSTOMER_SELECT },
            location: { select: ORDER_LOCATION_SELECT },
            items: withItems,
            payment: true,
          },
        },
        { ...paginationQuery },
      ),
      this.prismaService.location.findMany({
        where: {
          organizationId: org.organizationId,
          ...getLocationScopeWhere(org, 'id'),
        },
        orderBy: { name: 'asc' },
        select: ORDER_LOCATION_SELECT,
      }),
    ]);

    return {
      data: data.map((order) => this.attachPaymentSummary(order)),
      totalCount: total,
      locations: distinctLocations,
      nextCursor,
    };
  }

  async getOrderById(
    organization: CurrentOrg | string,
    orderId: string,
    query: GetOrderQueryDto,
  ) {
    const org = resolveOrganizationScope(organization);
    const order = await this.prismaService.order.findFirst({
      where: {
        id: orderId,
        organizationId: org.organizationId,
        ...getLocationScopeWhere(org),
      },
      include: {
        items: query.withItems,
        customer: { select: ORDER_CUSTOMER_SELECT },
        location: { select: ORDER_LOCATION_SELECT },
        payment: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return this.attachPaymentSummary(order);
  }

  async updateOrder(
    organization: CurrentOrg | string,
    orderId: string,
    data: UpdateOrderDto,
  ) {
    const org = resolveOrganizationScope(organization);

    if (data.customerId) {
      const ok = await this.prismaService.customer.findFirst({
        where: { id: data.customerId, organizationId: org.organizationId },
        select: { id: true },
      });
      if (!ok) {
        throw new BadRequestException('Customer not found with given id');
      }
    }

    if (data.locationId) {
      ensureLocationAccessible(org, data.locationId, {
        allowUnspecified: false,
      });

      const ok = await this.prismaService.location.findFirst({
        where: {
          organizationId: org.organizationId,
          ...(hasRestrictedLocations(org)
            ? {
                AND: [
                  { id: data.locationId },
                  getLocationScopeWhere(org, 'id'),
                ],
              }
            : { id: data.locationId }),
        },
        select: { id: true },
      });
      if (!ok) {
        throw new BadRequestException('Location not found with given id');
      }
    }

    if (hasRestrictedLocations(org)) {
      await this.assertOrderAccessible(org, orderId);
    }

    const updatedOrder = await this.prismaService.order.update({
      where: {
        id_organizationId: { id: orderId, organizationId: org.organizationId },
      },
      data,
      include: {
        payment: true,
      },
    });

    return this.attachPaymentSummary(updatedOrder);
  }

  async deleteOrder(organization: CurrentOrg | string, orderId: string) {
    const org = resolveOrganizationScope(organization);
    if (hasRestrictedLocations(org)) {
      await this.assertOrderAccessible(org, orderId);
    }

    const deletedOrder = await this.prismaService.order.delete({
      where: {
        id_organizationId: { id: orderId, organizationId: org.organizationId },
      },
      include: {
        payment: true,
      },
    });

    return this.attachPaymentSummary(deletedOrder);
  }

  async addOrderItem(
    organization: CurrentOrg | string,
    orderId: string,
    data: CreateOrderItemDto,
  ) {
    const org = resolveOrganizationScope(organization);

    return this.prismaService.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: {
          id: orderId,
          organizationId: org.organizationId,
          status: OrderStatus.PENDING,
          ...getLocationScopeWhere(org),
        },
        select: {
          id: true,
          items: { select: { id: true, productId: true } },
        },
      });

      if (!order) {
        throw new NotFoundException(
          'Order not found for organization or is not Pending',
        );
      }

      const product = await tx.product.findFirst({
        where: {
          id: data.productId,
          organizationId: org.organizationId,
        },
        select: { id: true, name: true, sku: true, priceCents: true },
      });
      if (!product) {
        throw new BadRequestException('Invalid product');
      }

      if (order.items.some(({ productId }) => productId === product.id)) {
        throw new BadRequestException(
          'Product already exist in order, update it instead',
        );
      }

      const qty = data.qty ?? 0;
      const discountCents = data.discountCents ?? 0;
      const taxCents = data.taxCents ?? 0;

      if (qty <= 0) {
        throw new BadRequestException('Item qty must be > 0');
      }
      if (discountCents < 0 || taxCents < 0) {
        throw new BadRequestException('Cents must be non-negative');
      }

      const lineSubtotalCents = qty * product.priceCents;
      if (discountCents > lineSubtotalCents) {
        throw new BadRequestException('Discount exceeds line subtotal');
      }
      const lineTotalCents = lineSubtotalCents - discountCents + taxCents;

      const updated = await tx.order.update({
        where: {
          id_organizationId: {
            id: orderId,
            organizationId: org.organizationId,
          },
        },
        data: {
          items: {
            create: {
              productId: product.id,
              productName: product.name,
              sku: product.sku ?? undefined,
              qty,
              unitPriceCents: product.priceCents,
              lineSubtotalCents,
              discountCents,
              taxCents,
              lineTotalCents,
            },
          },
          subtotalCents: { increment: lineSubtotalCents },
          discountCents: { increment: discountCents },
          taxCents: { increment: taxCents },
          totalCents: { increment: lineTotalCents },
        },
        include: {
          items: true,
          payment: true,
        },
      });

      return this.attachPaymentSummary(updated);
    });
  }

  async deleteOrderItem(
    organization: CurrentOrg | string,
    orderId: string,
    itemId: string,
  ) {
    const org = resolveOrganizationScope(organization);

    return this.prismaService.$transaction(async (tx) => {
      if (hasRestrictedLocations(org)) {
        await this.assertOrderAccessible(org, orderId);
      }

      const item = await tx.orderItem.findFirst({
        where: {
          id: itemId,
          orderId,
          organizationId: org.organizationId,
        },
        select: {
          id: true,
          lineSubtotalCents: true,
          discountCents: true,
          taxCents: true,
          lineTotalCents: true,
        },
      });

      if (!item) {
        throw new NotFoundException('Order item not found');
      }

      const count = await tx.orderItem.count({
        where: { orderId, organizationId: org.organizationId },
      });
      if (count <= 1) {
        throw new BadRequestException('Order must have at least one item');
      }

      const updated = await tx.order.update({
        where: {
          id_organizationId: {
            id: orderId,
            organizationId: org.organizationId,
          },
        },
        data: {
          items: { delete: { id: itemId } },
          subtotalCents: { decrement: item.lineSubtotalCents },
          discountCents: { decrement: item.discountCents },
          taxCents: { decrement: item.taxCents },
          totalCents: { decrement: item.lineTotalCents },
        },
        include: {
          items: true,
          payment: true,
        },
      });

      return this.attachPaymentSummary(updated);
    });
  }

  private attachPaymentSummary<T extends object>(
    order: T,
  ): T & { payment: ReturnType<typeof toPaymentSummaryDto> } {
    const payment = (order as { payment?: Payment | null }).payment;

    return {
      ...order,
      payment: toPaymentSummaryDto(payment as never),
    };
  }

  private async ensureTransitionPaymentTx(
    tx: Prisma.TransactionClient,
    order: {
      id: string;
      organizationId: string;
      status: OrderStatus;
      totalCents: number;
      createdAt: Date;
      placedAt: Date | null;
      payment?: { id: string } | null;
    },
  ) {
    if (order.payment) {
      return this.paymentService.getPaymentByIdTx(tx, order.payment.id);
    }

    return this.paymentService.ensureLegacyPaymentForOrderTx(tx, {
      orderId: order.id,
      organizationId: order.organizationId,
      orderStatus: order.status,
      amountCents: order.totalCents,
      orderCreatedAt: order.createdAt,
      placedAt: order.placedAt,
    });
  }

  private async assertOrderAccessible(org: CurrentOrg, orderId: string) {
    const order = await this.prismaService.order.findFirst({
      where: {
        id: orderId,
        organizationId: org.organizationId,
      },
      select: { id: true, locationId: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (
      hasRestrictedLocations(org) &&
      (!order.locationId || !org.allowedLocationIds.includes(order.locationId))
    ) {
      throw new ForbiddenException('You do not have access to this order');
    }
  }
}
