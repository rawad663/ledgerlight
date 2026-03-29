import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@src/infra/prisma/prisma.service';
import {
  CreateCustomerDto,
  CustomerDetailDto,
  GetCustomersQueryDto,
  GetCustomersResponseDto,
  UpdateCustomerDto,
} from './customer.dto';
import { Prisma } from '@prisma/generated/client';

export type GetCustomerByIdArgs = {
  organizationId: string;
  customerId: string;
};

@Injectable()
export class CustomerService {
  constructor(private readonly prismaService: PrismaService) {}

  async getCustomers(
    organizationId: string,
    query: GetCustomersQueryDto,
  ): Promise<GetCustomersResponseDto> {
    const { search, ...paginationQuery } = query;

    const where: Prisma.CustomerWhereInput = {
      organizationId,
      status: query.status,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const {
      data: customers,
      total,
      nextCursor,
    } = await this.prismaService.paginateMany(
      this.prismaService.customer,
      { where },
      { ...paginationQuery },
    );

    const customerIds = customers.map((c: { id: string }) => c.id);

    let statsMap = new Map<
      string,
      { sum: number; count: number; maxDate: Date | null }
    >();

    if (customerIds.length > 0) {
      const stats = await this.prismaService.order.groupBy({
        by: ['customerId'],
        where: { customerId: { in: customerIds }, organizationId },
        _sum: { totalCents: true },
        _count: true,
        _max: { createdAt: true },
      });

      statsMap = new Map(
        stats.map((s) => [
          s.customerId!,
          {
            sum: s._sum.totalCents ?? 0,
            count: s._count,
            maxDate: s._max.createdAt,
          },
        ]),
      );
    }

    const enrichedCustomers = customers.map(
      (customer: { id: string; [key: string]: unknown }) => {
        const stats = statsMap.get(customer.id);
        const lifetimeSpendCents = stats?.sum ?? 0;
        const ordersCount = stats?.count ?? 0;
        const avgOrderValueCents =
          ordersCount > 0 ? Math.round(lifetimeSpendCents / ordersCount) : 0;
        const lastOrderDate = stats?.maxDate ?? null;

        return {
          ...customer,
          lifetimeSpendCents,
          ordersCount,
          avgOrderValueCents,
          lastOrderDate,
        };
      },
    );

    return {
      data: enrichedCustomers as GetCustomersResponseDto['data'],
      totalCount: total,
      nextCursor,
    };
  }

  async getCustomerById({
    organizationId,
    customerId,
  }: GetCustomerByIdArgs): Promise<CustomerDetailDto> {
    const customer = await this.prismaService.customer.findFirst({
      where: { id: customerId, organizationId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const [aggregateResult, recentOrders] = await Promise.all([
      this.prismaService.order.aggregate({
        where: { customerId, organizationId },
        _sum: { totalCents: true },
        _count: true,
        _max: { createdAt: true },
      }),
      this.prismaService.order.findMany({
        where: { customerId, organizationId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, totalCents: true, status: true, createdAt: true },
      }),
    ]);

    const lifetimeSpendCents = aggregateResult._sum.totalCents ?? 0;
    const ordersCount = aggregateResult._count;
    const avgOrderValueCents =
      ordersCount > 0 ? Math.round(lifetimeSpendCents / ordersCount) : 0;
    const lastOrderDate = aggregateResult._max.createdAt ?? null;

    return {
      ...customer,
      lifetimeSpendCents,
      ordersCount,
      avgOrderValueCents,
      lastOrderDate,
      recentOrders,
    };
  }

  async createCustomer({
    organizationId,
    customerData,
  }: {
    organizationId: string;
    customerData: CreateCustomerDto;
  }) {
    const customer = await this.prismaService.customer.create({
      data: {
        ...customerData,
        status: 'ACTIVE',
        organizationId,
      },
    });

    return customer;
  }

  async updateCustomer({
    organizationId,
    customerId,
    customerData,
  }: {
    organizationId: string;
    customerId: string;
    customerData: Partial<UpdateCustomerDto>;
  }) {
    const customer = await this.prismaService.customer.update({
      where: { id: customerId, organizationId },
      data: customerData,
    });

    return customer;
  }

  async deleteCustomer({ organizationId, customerId }: GetCustomerByIdArgs) {
    const customer = await this.prismaService.customer.delete({
      where: { id: customerId, organizationId },
    });

    return customer;
  }
}
