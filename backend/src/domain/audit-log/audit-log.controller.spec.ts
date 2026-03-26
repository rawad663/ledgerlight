import { Test } from '@nestjs/testing';
import { AuditLogController } from './audit-log.controller';
import { AuditLogService } from './audit-log.service';
import {
  OrganizationContextGuard,
  JwtAuthGuard,
  RolesGuard,
} from '@src/common/guards';
import { PrismaService } from '@src/infra/prisma/prisma.service';
import { AuditEntityType } from '@prisma/generated/enums';

describe('AuditLogController', () => {
  let controller: AuditLogController;
  let service: jest.Mocked<AuditLogService>;

  const org = { organizationId: 'org-1', role: 'ADMIN' };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuditLogController],
      providers: [
        {
          provide: AuditLogService,
          useValue: {
            getAuditLogs: jest.fn(),
          },
        },
        {
          provide: OrganizationContextGuard,
          useValue: { canActivate: jest.fn().mockReturnValue(true) },
        },
        {
          provide: JwtAuthGuard,
          useValue: { canActivate: jest.fn().mockReturnValue(true) },
        },
        {
          provide: RolesGuard,
          useValue: { canActivate: jest.fn().mockReturnValue(true) },
        },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    controller = module.get(AuditLogController);
    service = module.get(AuditLogService);
  });

  describe('getAuditLogs', () => {
    it('delegates to service with org and query', async () => {
      const result = { data: [], totalCount: 0 };
      service.getAuditLogs.mockResolvedValue(result as any);

      const query = {
        entityType: AuditEntityType.ORDER,
        entityId: 'ord-1',
        limit: 20,
      };

      const response = await controller.getAuditLogs(org as any, query as any);

      expect(service.getAuditLogs).toHaveBeenCalledWith(
        org.organizationId,
        query,
      );
      expect(response).toBe(result);
    });
  });
});
