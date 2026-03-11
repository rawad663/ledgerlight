import { Injectable, NotFoundException } from '@nestjs/common';
import { Customer } from '@prisma/generated/client';
import { PrismaService } from '@src/infra/prisma/prisma.service';
import { GetCustomersQueryParamDto } from './customer.dto';

export type GetCustomersArgs = {
  organizationId: string;
  query: GetCustomersQueryParamDto;
};

export type GetCustomerByIdArgs = {
  organizationId: string;
  customerId: string;
};

@Injectable()
export class CustomerService {
  constructor(private readonly prismaService: PrismaService) {}

  async getCustomers({ organizationId, query }: GetCustomersArgs): Promise<{
    data: Customer[];
    nextCursor?: string;
    totalCount: number;
  }> {
    const customers = await this.prismaService.paginateMany(
      this.prismaService.customer,
      {
        where: { organizationId },
      },
      {
        limit: query.limit,
        cursor: query.cursor,
        orderBy: query.sortBy
          ? { [query.sortBy]: query.sortOrder || 'desc' }
          : undefined,
      },
    );

    return {
      data: customers,
      totalCount: customers.length,
      nextCursor:
        customers.length === query.limit
          ? customers[customers.length - 1].id
          : undefined,
    };
  }

  async getCustomerById({ organizationId, customerId }: GetCustomerByIdArgs) {
    const customer = await this.prismaService.customer.findFirst({
      where: { id: customerId, organizationId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }
}
