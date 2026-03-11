/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/generated/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async paginateMany<T, Y>(
    model: {
      findMany: (args: Y) => Promise<T[]>;
    },
    query: Y,
    paginationOptions: {
      limit: number;
      cursor?: string;
      orderBy?: Record<string, 'asc' | 'desc'>;
    },
  ) {
    const result = await model.findMany({
      ...query,
      take: paginationOptions.limit,
      ...(paginationOptions.cursor && {
        cursor: { id: paginationOptions.cursor },
        skip: 1,
      }),
      orderBy: paginationOptions.orderBy || { createdAt: 'desc' },
    });

    return result;
  }
}
