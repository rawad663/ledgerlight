import { Injectable } from '@nestjs/common';
import { PrismaService } from '@src/infra/prisma/prisma.service';
import { GetAuditLogsQueryDto } from './audit-log.dto';
import { Prisma } from '@prisma/generated/client';

@Injectable()
export class AuditLogService {
  constructor(private readonly prismaService: PrismaService) {}

  async getAuditLogs(orgId: string, query: GetAuditLogsQueryDto) {
    const { entityType, entityId, ...paginationQuery } = query;

    const where: Prisma.AuditLogWhereInput = { organizationId: orgId };

    if (entityType) {
      where.entityType = entityType;
    }

    if (entityId) {
      where.entityId = entityId;
    }

    const { data, total } = await this.prismaService.paginateMany(
      this.prismaService.auditLog,
      {
        where,
        include: {
          actor: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      },
      {
        ...paginationQuery,
        orderBy: paginationQuery.sortBy
          ? { [paginationQuery.sortBy]: paginationQuery.sortOrder || 'desc' }
          : { createdAt: 'desc' },
      },
    );

    return {
      data,
      totalCount: total,
      nextCursor:
        data.length === paginationQuery.limit
          ? data[data.length - 1].id
          : undefined,
    };
  }
}
