import { Test } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardSalesTimeline } from './dashboard.dto';
import {
  JwtAuthGuard,
  OrganizationContextGuard,
  PermissionsGuard,
} from '@src/common/guards';
import { PrismaService } from '@src/infra/prisma/prisma.service';

describe('DashboardController', () => {
  let controller: DashboardController;
  let service: jest.Mocked<DashboardService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        {
          provide: DashboardService,
          useValue: {
            getSummary: jest.fn(),
            getSalesOverview: jest.fn(),
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
          provide: PermissionsGuard,
          useValue: { canActivate: jest.fn().mockReturnValue(true) },
        },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    controller = module.get(DashboardController);
    service = module.get(DashboardService);
  });

  it('returns summary for managers', async () => {
    const result = {
      todaysSalesCents: 1200,
      ordersTodayCount: 4,
      lowStockItemsCount: 2,
      activeCustomersCount: 14,
    };
    service.getSummary.mockResolvedValue(result);

    await expect(
      controller.getSummary({
        organizationId: 'org-1',
        role: 'MANAGER',
      } as any),
    ).resolves.toEqual(result);

    expect(service.getSummary).toHaveBeenCalledWith('org-1');
  });

  it('is protected by @RequirePermissions — role enforcement is done by PermissionsGuard', () => {
    const permissions = Reflect.getMetadata(
      'permissions',
      DashboardController.prototype.getSummary,
    );
    expect(permissions).toBeDefined();
    expect(Array.isArray(permissions)).toBe(true);
    expect(permissions.length).toBeGreaterThan(0);
  });

  it('returns sales overview for managers', async () => {
    const result = {
      timeline: DashboardSalesTimeline.WEEK,
      anchor: new Date('2026-03-30T00:00:00.000Z'),
      periodStart: new Date('2026-03-30T00:00:00.000Z'),
      periodEnd: new Date('2026-04-06T00:00:00.000Z'),
      previousAnchor: new Date('2026-03-23T00:00:00.000Z'),
      nextAnchor: new Date('2026-04-06T00:00:00.000Z'),
      isCurrentPeriod: true,
      totalSalesCents: 25000,
      buckets: [],
    };
    service.getSalesOverview.mockResolvedValue(result as any);
    const query = {
      timeline: DashboardSalesTimeline.WEEK,
    };

    await expect(
      controller.getSalesOverview(
        {
          organizationId: 'org-1',
          role: 'MANAGER',
        } as any,
        query,
      ),
    ).resolves.toEqual(result);

    expect(service.getSalesOverview).toHaveBeenCalledWith('org-1', query);
  });
});
