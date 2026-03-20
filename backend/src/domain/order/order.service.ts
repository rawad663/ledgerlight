import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '@src/infra/prisma/prisma.service';
import {
  CreateOrderDto,
  OrderDto,
  OrderItemDto,
  TransitionStatusBodyDto,
} from './order.dto';
import { OrderStatus } from '@prisma/generated/enums';

@Injectable()
export class OrderService {
  constructor(private readonly prismaService: PrismaService) {}

  async createOrder(orgId: string, data: CreateOrderDto) {
    const { orderItems, customerId, locationId } = data;

    if (!orderItems?.length) {
      throw new BadRequestException('Order must contain at least one item');
    }

    return this.prismaService.$transaction(async (tx) => {
      // Verify validity of optional references within org
      if (customerId) {
        const ok = await tx.customer.findFirst({
          where: { id: customerId, organizationId: orgId },
          select: { id: true },
        });
        if (!ok)
          throw new BadRequestException('Invalid customer for organization');
      }
      if (locationId) {
        const ok = await tx.location.findFirst({
          where: { id: locationId, organizationId: orgId },
          select: { id: true },
        });
        if (!ok)
          throw new BadRequestException('Invalid location for organization');
      }

      // Snapshot products by ID and org
      const productIds = [...new Set(orderItems.map((i) => i.productId))];
      const products = await tx.product.findMany({
        where: { id: { in: productIds }, organizationId: orgId, active: true },
        select: { id: true, name: true, sku: true, priceCents: true },
      });

      const byId = new Map(products.map((p) => [p.id, p]));
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
        // normalize arithmetics to avoid surprises
        const discountCents = raw.discountCents ?? 0;
        const taxCents = raw.taxCents ?? 0;
        const qty = raw.qty ?? 0;

        if (qty <= 0) throw new Error('Item qty must be > 0');
        if (discountCents < 0 || taxCents < 0) {
          throw new BadRequestException('Cents values must be non-negative');
        }

        const p = byId.get(raw.productId)!;
        const lineSubtotalCents = raw.qty * p.priceCents;
        if (discountCents > lineSubtotalCents)
          throw new BadRequestException('Discount cannot exceed line subtotal');

        const lineTotalCents = lineSubtotalCents - discountCents + taxCents;

        computedLineItems.push({
          productId: raw.productId,
          productName: p.name,
          sku: p.sku ?? undefined,
          qty,
          unitPriceCents: p.priceCents,
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

      // createManyAndReturn for large carts to maintain efficiency
      if (orderItems.length > 20) {
        const order = await tx.order.create({
          data: {
            ...totals,
            customerId,
            locationId,
            organizationId: orgId,
            status: OrderStatus.PENDING,
          },
        });

        const createdItems = await tx.orderItem.createManyAndReturn({
          data: computedLineItems.map((i) => ({ ...i, orderId: order.id })),
        });

        return {
          ...order,
          items: createdItems,
        };
      }

      // Reduce queries for small carts
      const order = await tx.order.create({
        data: {
          ...totals,
          customerId,
          locationId,
          organizationId: orgId,
          status: OrderStatus.PENDING,
          items: { create: computedLineItems },
        },
        include: { items: true },
      });

      return order;
    });
  }

  async transitionStatus(
    orderId: string,
    { toStatus }: TransitionStatusBodyDto,
  ) {
    let updatedOrder: OrderDto;

    switch (toStatus) {
      case 'CONFIRMED':
        updatedOrder = await this.prismaService.order.update({
          where: { id: orderId },
          data: { status: toStatus, placedAt: new Date(), cancelledAt: null },
        });
        break;
      case 'CANCELLED':
        updatedOrder = await this.prismaService.order.update({
          where: { id: orderId },
          data: { status: toStatus, cancelledAt: new Date() },
        });
        break;
      case 'FULFILLED':
      case 'PENDING':
      case 'REFUNDED':
        updatedOrder = await this.prismaService.order.update({
          where: { id: orderId },
          data: { status: toStatus },
        });
        break;
      default:
        throw new BadRequestException('Unknown value for status update');
    }

    return updatedOrder;
  }
}
