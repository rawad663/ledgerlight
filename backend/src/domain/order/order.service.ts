import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type CurrentOrg } from '@src/common/decorators/current-org.decorator';
import {
  ensureLocationAccessible,
  getLocationScopeWhere,
  hasRestrictedLocations,
  resolveOrganizationScope,
} from '@src/common/organization/location-scope';
import { PrismaService } from '@src/infra/prisma/prisma.service';
import {
  CreateOrderDto,
  CreateOrderItemDto,
  GetOrderQueryDto,
  GetOrdersQueryDto,
  OrderDto,
  OrderItemDto,
  TransitionStatusBodyDto,
  UpdateOrderDto,
} from './order.dto';
import { OrderStatus } from '@prisma/generated/enums';
import { Prisma } from '@prisma/generated/client';

@Injectable()
export class OrderService {
  constructor(private readonly prismaService: PrismaService) {}

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
      // Verify validity of optional references within org
      if (customerId) {
        const ok = await tx.customer.findFirst({
          where: { id: customerId, organizationId: org.organizationId },
          select: { id: true },
        });
        if (!ok)
          throw new BadRequestException('Invalid customer for organization');
      }
      if (locationId) {
        const ok = await tx.location.findFirst({
          where: {
            id: locationId,
            organizationId: org.organizationId,
            ...getLocationScopeWhere(org),
          },
          select: { id: true },
        });
        if (!ok)
          throw new BadRequestException('Invalid location for organization');
      }

      // Snapshot products by ID and org
      const productIds = [...new Set(orderItems.map((i) => i.productId))];
      const products = await tx.product.findMany({
        where: {
          id: { in: productIds },
          organizationId: org.organizationId,
          active: true,
        },
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

        if (qty <= 0) throw new BadRequestException('Item qty must be > 0');
        if (discountCents < 0 || taxCents < 0) {
          throw new BadRequestException('Cents values must be non-negative');
        }

        const p = byId.get(raw.productId)!;
        const lineSubtotalCents = qty * p.priceCents;
        if (discountCents > lineSubtotalCents)
          throw new BadRequestException('Discount cannot exceed line subtotal');

        const lineTotalCents = lineSubtotalCents - discountCents + taxCents;

        computedLineItems.push({
          organizationId: org.organizationId,
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
            organizationId: org.organizationId,
            status: OrderStatus.PENDING,
          },
        });

        const createdItems = await tx.orderItem.createManyAndReturn({
          data: computedLineItems.map((i) => ({
            ...i,
            orderId: order.id,
          })),
        });

        return {
          ...order,
          items: createdItems,
        };
      }

      // Reduce queries for small carts
      // Prisma auto-sets relation fields (orderId, organizationId) on nested creates,
      // so we must strip organizationId to avoid "Unknown argument" errors.
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

      return order;
    });
  }

  async transitionStatus(
    organization: CurrentOrg | string,
    orderId: string,
    { toStatus }: TransitionStatusBodyDto,
  ) {
    const org = resolveOrganizationScope(organization);
    const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
      PENDING: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      CONFIRMED: [OrderStatus.FULFILLED, OrderStatus.CANCELLED],
      CANCELLED: [OrderStatus.PENDING], // re-open
      FULFILLED: [OrderStatus.REFUNDED],
      REFUNDED: [],
    };

    const currentOrderRecord = hasRestrictedLocations(org)
      ? await this.prismaService.order.findFirst({
          where: {
            id: orderId,
            organizationId: org.organizationId,
            ...getLocationScopeWhere(org),
          },
          select: { id: true, status: true },
        })
      : await this.prismaService.order.findUnique({
          where: {
            id_organizationId: {
              id: orderId,
              organizationId: org.organizationId,
            },
          },
          select: { id: true, status: true },
        });
    if (!currentOrderRecord) {
      throw new NotFoundException('Order not found for organization');
    }

    if (!ALLOWED_TRANSITIONS[currentOrderRecord.status].includes(toStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${currentOrderRecord.status} to ${toStatus}`,
      );
    }

    let updatedOrder: OrderDto;

    switch (toStatus) {
      case 'CONFIRMED':
        updatedOrder = await this.prismaService.order.update({
          where: {
            id_organizationId: {
              id: orderId,
              organizationId: org.organizationId,
            },
          },
          data: { status: toStatus, placedAt: new Date(), cancelledAt: null },
        });
        break;
      case 'CANCELLED':
        updatedOrder = await this.prismaService.order.update({
          where: {
            id_organizationId: {
              id: orderId,
              organizationId: org.organizationId,
            },
          },
          data: { status: toStatus, cancelledAt: new Date() },
        });
        break;
      case 'PENDING':
        updatedOrder = await this.prismaService.order.update({
          where: {
            id_organizationId: {
              id: orderId,
              organizationId: org.organizationId,
            },
          },
          data: { status: toStatus, placedAt: null, cancelledAt: null },
        });
        break;
      case 'FULFILLED':
      case 'REFUNDED':
        updatedOrder = await this.prismaService.order.update({
          where: {
            id_organizationId: {
              id: orderId,
              organizationId: org.organizationId,
            },
          },
          data: { status: toStatus },
        });
        break;
      default:
        throw new BadRequestException('Unknown value for status update');
    }

    return updatedOrder;
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
            customer: { select: { id: true, name: true, email: true } },
            location: {
              select: {
                id: true,
                name: true,
                addressLine1: true,
                city: true,
                stateProvince: true,
                postalCode: true,
                countryCode: true,
              },
            },
            items: withItems,
          },
        },
        { ...paginationQuery },
      ),
      this.prismaService.location.findMany({
        where: {
          organizationId: org.organizationId,
          ...getLocationScopeWhere(org),
        },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          addressLine1: true,
          city: true,
          stateProvince: true,
          postalCode: true,
          countryCode: true,
        },
      }),
    ]);

    return {
      data,
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
    const order = hasRestrictedLocations(org)
      ? await this.prismaService.order.findFirst({
          where: {
            id: orderId,
            organizationId: org.organizationId,
            ...getLocationScopeWhere(org),
          },
          include: {
            items: query.withItems,
            customer: { select: { id: true, name: true, email: true } },
            location: {
              select: {
                id: true,
                name: true,
                addressLine1: true,
                city: true,
                stateProvince: true,
                postalCode: true,
                countryCode: true,
              },
            },
          },
        })
      : await this.prismaService.order.findUnique({
          where: {
            id_organizationId: {
              id: orderId,
              organizationId: org.organizationId,
            },
          },
          include: {
            items: query.withItems,
            customer: { select: { id: true, name: true, email: true } },
            location: {
              select: {
                id: true,
                name: true,
                addressLine1: true,
                city: true,
                stateProvince: true,
                postalCode: true,
                countryCode: true,
              },
            },
          },
        });

    if (!order) {
      throw new NotFoundException(`Order not found`);
    }

    const ok = order?.organizationId === org.organizationId;
    if (!ok) {
      throw new BadRequestException(
        'Order does not belong to provided organization',
      );
    }

    return order;
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
          id: data.locationId,
          organizationId: org.organizationId,
          ...getLocationScopeWhere(org),
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
    });

    return updatedOrder;
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
    });

    return deletedOrder;
  }

  async addOrderItem(
    organization: CurrentOrg | string,
    orderId: string,
    data: CreateOrderItemDto,
  ) {
    const org = resolveOrganizationScope(organization);
    return this.prismaService.$transaction(async (tx) => {
      const order = hasRestrictedLocations(org)
        ? await tx.order.findFirst({
            where: {
              id: orderId,
              organizationId: org.organizationId,
              status: 'PENDING',
              ...getLocationScopeWhere(org),
            },
            select: {
              id: true,
              status: true,
              items: { select: { id: true, productId: true } },
            },
          })
        : await tx.order.findUnique({
            where: {
              id_organizationId: {
                id: orderId,
                organizationId: org.organizationId,
              },
            },
            select: {
              id: true,
              status: true,
              items: { select: { id: true, productId: true } },
            },
          });
      if (
        !order ||
        ('status' in order &&
          order.status !== undefined &&
          order.status !== 'PENDING')
      )
        throw new NotFoundException(
          'Order not found for organization or is not Pending',
        );

      const product = await tx.product.findFirst({
        where: { id: data.productId, organizationId: org.organizationId },
        select: { id: true, name: true, sku: true, priceCents: true },
      });
      if (!product) throw new BadRequestException('Invalid product');
      if (
        (order.items as Array<{ id: string; productId: string }>).some(
          ({ productId }) => productId === product.id,
        )
      ) {
        throw new BadRequestException(
          'Product already exist in order, update it instead',
        );
      }

      const qty = data.qty ?? 0;
      const discountCents = data.discountCents ?? 0;
      const taxCents = data.taxCents ?? 0;

      if (qty <= 0) throw new BadRequestException('Item qty must be > 0');
      if (discountCents < 0 || taxCents < 0)
        throw new BadRequestException('Cents must be non-negative');

      const lineSubtotalCents = qty * product.priceCents;
      if (discountCents > lineSubtotalCents)
        throw new BadRequestException('Discount exceeds line subtotal');
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
        include: { items: true },
      });

      return updated;
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
      if (!item) throw new NotFoundException('Order item not found');

      // Optional: prevent removing the last item
      const count = await tx.orderItem.count({
        where: { orderId, organizationId: org.organizationId },
      });
      if (count <= 1)
        throw new BadRequestException('Order must have at least one item');

      const updated = await tx.order.update({
        where: {
          id_organizationId: {
            id: orderId,
            organizationId: org.organizationId,
          },
          status: 'PENDING',
        },
        data: {
          items: { delete: { id: itemId } },
          subtotalCents: { decrement: item.lineSubtotalCents },
          discountCents: { decrement: item.discountCents },
          taxCents: { decrement: item.taxCents },
          totalCents: { decrement: item.lineTotalCents },
        },
        include: { items: true },
      });

      return updated;
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
