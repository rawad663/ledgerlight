import { PrismaService } from '@src/infra/prisma/prisma.service';
import { AuditLogService } from './audit-log.service';
import { createPrismaMock } from '@src/test-utils/prisma.mock';
import { Test } from '@nestjs/testing';
import { AuditEntityType } from '@prisma/generated/enums';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    prisma = createPrismaMock();

    const module = await Test.createTestingModule({
      providers: [
        AuditLogService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(AuditLogService);
  });

  const orgId = 'org-1';

  describe('getAuditLogs', () => {
    it('fetches audit logs with org filter and default ordering', async () => {
      const items = [{ id: 'log-1' }, { id: 'log-2' }] as any[];
      (prisma.paginateMany as jest.Mock).mockResolvedValue({
        data: items,
        total: 5,
      });

      const result = await service.getAuditLogs(orgId, { limit: 2 } as any);

      expect(prisma.paginateMany).toHaveBeenCalledWith(
        (prisma as any).auditLog,
        {
          where: { organizationId: orgId },
          include: {
            actor: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        expect.objectContaining({
          limit: 2,
          orderBy: { createdAt: 'desc' },
        }),
      );
      expect(result).toEqual({
        data: items,
        totalCount: 5,
        nextCursor: 'log-2',
      });
    });

    it('applies entityType filter', async () => {
      (prisma.paginateMany as jest.Mock).mockResolvedValue({
        data: [],
        total: 0,
      });

      await service.getAuditLogs(orgId, {
        entityType: AuditEntityType.ORDER,
        limit: 20,
      } as any);

      expect(prisma.paginateMany).toHaveBeenCalledWith(
        (prisma as any).auditLog,
        expect.objectContaining({
          where: {
            organizationId: orgId,
            entityType: AuditEntityType.ORDER,
          },
        }),
        expect.anything(),
      );
    });

    it('applies entityId filter', async () => {
      (prisma.paginateMany as jest.Mock).mockResolvedValue({
        data: [],
        total: 0,
      });

      await service.getAuditLogs(orgId, {
        entityId: 'ord-123',
        limit: 20,
      } as any);

      expect(prisma.paginateMany).toHaveBeenCalledWith(
        (prisma as any).auditLog,
        expect.objectContaining({
          where: {
            organizationId: orgId,
            entityId: 'ord-123',
          },
        }),
        expect.anything(),
      );
    });

    it('applies both entityType and entityId filters', async () => {
      (prisma.paginateMany as jest.Mock).mockResolvedValue({
        data: [],
        total: 0,
      });

      await service.getAuditLogs(orgId, {
        entityType: AuditEntityType.ORDER,
        entityId: 'ord-123',
        limit: 20,
      } as any);

      expect(prisma.paginateMany).toHaveBeenCalledWith(
        (prisma as any).auditLog,
        expect.objectContaining({
          where: {
            organizationId: orgId,
            entityType: AuditEntityType.ORDER,
            entityId: 'ord-123',
          },
        }),
        expect.anything(),
      );
    });

    it('returns no nextCursor when data length < limit', async () => {
      (prisma.paginateMany as jest.Mock).mockResolvedValue({
        data: [{ id: 'log-1' }],
        total: 1,
      });

      const result = await service.getAuditLogs(orgId, { limit: 20 } as any);

      expect(result.nextCursor).toBeUndefined();
    });

    it('uses custom sortBy when provided', async () => {
      (prisma.paginateMany as jest.Mock).mockResolvedValue({
        data: [],
        total: 0,
      });

      await service.getAuditLogs(orgId, {
        limit: 20,
        sortBy: 'action',
        sortOrder: 'asc',
      } as any);

      expect(prisma.paginateMany).toHaveBeenCalledWith(
        (prisma as any).auditLog,
        expect.anything(),
        expect.objectContaining({
          orderBy: { action: 'asc' },
        }),
      );
    });
  });
});
