import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/generated/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private static readonly SORT_CURSOR_VERSION = 1;

  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
      pool: {
        max: parseInt(process.env.DB_POOL_MAX || '10', 10),
        idleTimeout: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30', 10),
        connectionTimeout: parseInt(
          process.env.DB_POOL_CONNECTION_TIMEOUT || '5',
          10,
        ),
      },
    });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  private buildOrderBy(sortBy?: string, sortOrder?: 'asc' | 'desc') {
    return sortBy ? { [sortBy]: sortOrder || 'desc' } : undefined;
  }

  private normalizeOrderBy(
    orderBy?: Record<string, 'asc' | 'desc' | Record<string, any>>,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
  ) {
    const resolvedOrderBy = orderBy || this.buildOrderBy(sortBy, sortOrder);

    if (!resolvedOrderBy) {
      return undefined;
    }

    const normalized = Array.isArray(resolvedOrderBy)
      ? [...resolvedOrderBy]
      : [resolvedOrderBy];

    const [primaryOrderBy] = normalized;
    const [primarySortField, primarySortDirection] = primaryOrderBy
      ? Object.entries(primaryOrderBy)[0] || []
      : [];

    if (
      primarySortField &&
      primarySortField !== 'id' &&
      (primarySortDirection === 'asc' || primarySortDirection === 'desc') &&
      !normalized.some((entry) => Object.keys(entry).includes('id'))
    ) {
      normalized.push({ id: primarySortDirection });
    }

    return normalized;
  }

  private extractSortCursorConfig(
    orderBy?: Array<Record<string, 'asc' | 'desc' | Record<string, any>>>,
  ) {
    const [primaryOrderBy] = orderBy || [];
    if (!primaryOrderBy) {
      return undefined;
    }

    const [field, direction] = Object.entries(primaryOrderBy)[0] || [];
    if (!field || field === 'id') {
      return undefined;
    }

    if (direction !== 'asc' && direction !== 'desc') {
      return undefined;
    }

    return { field, direction };
  }

  private encodeCursor(args: {
    id: string;
    sortField?: string;
    sortValue?: unknown;
  }) {
    if (!args.sortField) {
      return args.id;
    }

    return Buffer.from(
      JSON.stringify({
        v: PrismaService.SORT_CURSOR_VERSION,
        id: args.id,
        sortField: args.sortField,
        sortValue:
          args.sortValue instanceof Date
            ? { type: 'date', value: args.sortValue.toISOString() }
            : { type: typeof args.sortValue, value: args.sortValue },
      }),
      'utf8',
    ).toString('base64url');
  }

  private decodeCursor(
    cursor: string,
    sortField?: string,
  ): { id: string; sortValue?: unknown } {
    if (!sortField) {
      return { id: cursor };
    }

    try {
      const decoded = JSON.parse(
        Buffer.from(cursor, 'base64url').toString('utf8'),
      ) as {
        v?: number;
        id?: string;
        sortField?: string;
        sortValue?: { type?: string; value?: unknown };
      };

      if (
        decoded.v !== PrismaService.SORT_CURSOR_VERSION ||
        typeof decoded.id !== 'string' ||
        decoded.sortField !== sortField
      ) {
        return { id: cursor };
      }

      if (decoded.sortValue?.type === 'date') {
        return {
          id: decoded.id,
          sortValue: new Date(String(decoded.sortValue.value)),
        };
      }

      return { id: decoded.id, sortValue: decoded.sortValue?.value };
    } catch {
      return { id: cursor };
    }
  }

  private buildCursorWhere(args: {
    where?: unknown;
    cursor?: string;
    sortField?: string;
    sortDirection?: 'asc' | 'desc';
  }) {
    if (!args.cursor) {
      return args.where;
    }

    if (!args.sortField || !args.sortDirection) {
      return args.where;
    }

    const decodedCursor = this.decodeCursor(args.cursor, args.sortField);
    if (
      decodedCursor.sortValue === undefined ||
      decodedCursor.sortValue === null
    ) {
      return args.where;
    }

    const comparisonOperator = args.sortDirection === 'asc' ? 'gt' : 'lt';
    const cursorWhere = {
      OR: [
        {
          [args.sortField]: {
            [comparisonOperator]: decodedCursor.sortValue,
          },
        },
        {
          [args.sortField]: decodedCursor.sortValue,
          id: {
            [comparisonOperator]: decodedCursor.id,
          },
        },
      ],
    };

    if (!args.where) {
      return cursorWhere;
    }

    return {
      AND: [args.where, cursorWhere],
    };
  }

  /**
   * TODO: Consider in the future moving this helper into a seperate class to keep this service focused
   * on Client Management. Something like "src/common/utils/pagination.ts"
   */
  async paginateMany<T, Y>(
    model: {
      findMany: (args: Y) => Promise<T[]>;
      count: (...args: never[]) => Promise<number>;
    },
    query: Y,
    paginationOptions: {
      limit: number;
      cursor?: string;
      orderBy?: Record<string, 'asc' | 'desc' | Record<string, any>>;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    },
  ) {
    const countFn = model.count as (arg: {
      where?: unknown;
    }) => Promise<number>;

    const orderBy = this.normalizeOrderBy(
      paginationOptions.orderBy,
      paginationOptions.sortBy,
      paginationOptions.sortOrder,
    );
    const sortCursorConfig = this.extractSortCursorConfig(orderBy);
    const queryWithCursorWhere = {
      ...(query as Record<string, unknown>),
      where: this.buildCursorWhere({
        where: (query as { where?: unknown }).where,
        cursor: paginationOptions.cursor,
        sortField: sortCursorConfig?.field,
        sortDirection: sortCursorConfig?.direction,
      }),
    } as Y;

    const [data, total] = await Promise.all([
      model.findMany({
        ...queryWithCursorWhere,
        take: paginationOptions.limit,
        ...(paginationOptions.cursor &&
          !sortCursorConfig && {
            cursor: { id: paginationOptions.cursor },
            skip: 1,
          }),
        orderBy,
      }),
      countFn({ where: (query as { where?: unknown }).where }),
    ]);

    const lastRecord = data[data.length - 1] as
      | ({ id?: string } & Record<string, unknown>)
      | undefined;
    const nextCursor =
      data.length === paginationOptions.limit && lastRecord?.id
        ? this.encodeCursor({
            id: lastRecord.id,
            sortField: sortCursorConfig?.field,
            sortValue: sortCursorConfig?.field
              ? lastRecord[sortCursorConfig.field]
              : undefined,
          })
        : undefined;

    return { data, total, nextCursor };
  }
}
