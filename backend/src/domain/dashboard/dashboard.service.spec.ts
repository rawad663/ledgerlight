import { Test } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '@src/infra/prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { createPrismaMock } from '@src/test-utils/prisma.mock';
import { DashboardSalesTimeline } from './dashboard.dto';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: jest.Mocked<PrismaService>;
  let inventoryService: { getLowStockProductCount: jest.Mock };

  beforeEach(async () => {
    prisma = createPrismaMock();
    inventoryService = {
      getLowStockProductCount: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
        { provide: InventoryService, useValue: inventoryService },
      ],
    }).compile();

    service = module.get(DashboardService);
  });

  it('returns summary metrics from live backend data sources', async () => {
    prisma.order.aggregate.mockResolvedValue({
      _sum: { totalCents: 456700 },
    } as any);
    prisma.order.count.mockResolvedValue(12);
    prisma.customer.count.mockResolvedValue(27);
    inventoryService.getLowStockProductCount.mockResolvedValue(5);

    await expect(service.getSummary('org-1')).resolves.toEqual({
      todaysSalesCents: 456700,
      ordersTodayCount: 12,
      lowStockItemsCount: 5,
      activeCustomersCount: 27,
    });

    expect(prisma.order.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          status: { in: ['CONFIRMED', 'FULFILLED'] },
          placedAt: expect.objectContaining({
            gte: expect.any(Date),
            lt: expect.any(Date),
          }),
        }),
      }),
    );
    expect(prisma.order.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          status: { in: ['CONFIRMED', 'FULFILLED'] },
          placedAt: expect.objectContaining({
            gte: expect.any(Date),
            lt: expect.any(Date),
          }),
        }),
      }),
    );
    expect(prisma.customer.count).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', status: 'ACTIVE' },
    });
    expect(inventoryService.getLowStockProductCount).toHaveBeenCalledWith(
      'org-1',
    );
  });

  it('falls back to zero sales when no orders match today', async () => {
    prisma.order.aggregate.mockResolvedValue({
      _sum: { totalCents: null },
    } as any);
    prisma.order.count.mockResolvedValue(0);
    prisma.customer.count.mockResolvedValue(0);
    inventoryService.getLowStockProductCount.mockResolvedValue(0);

    await expect(service.getSummary('org-1')).resolves.toEqual({
      todaysSalesCents: 0,
      ordersTodayCount: 0,
      lowStockItemsCount: 0,
      activeCustomersCount: 0,
    });
  });

  describe('getSalesOverview', () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date('2026-04-01T15:30:00'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('returns 24 hourly buckets for the selected day', async () => {
      prisma.order.findMany.mockResolvedValue([
        {
          placedAt: new Date('2026-04-01T01:15:00'),
          totalCents: 1200,
        },
        {
          placedAt: new Date('2026-04-01T13:45:00'),
          totalCents: 3400,
        },
      ] as any);

      const result = await service.getSalesOverview('org-1', {
        timeline: DashboardSalesTimeline.DAY,
      });

      expect(result.timeline).toBe(DashboardSalesTimeline.DAY);
      expect(result.buckets).toHaveLength(24);
      expect(result.totalSalesCents).toBe(4600);
      expect(result.buckets[1]).toEqual(
        expect.objectContaining({ label: '1 AM', salesCents: 1200 }),
      );
      expect(result.buckets[13]).toEqual(
        expect.objectContaining({ label: '1 PM', salesCents: 3400 }),
      );
      expect(prisma.order.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-1',
          status: { in: ['CONFIRMED', 'FULFILLED'] },
          placedAt: {
            gte: new Date('2026-04-01T00:00:00'),
            lt: new Date('2026-04-02T00:00:00'),
          },
        },
        select: {
          placedAt: true,
          totalCents: true,
        },
        orderBy: {
          placedAt: 'asc',
        },
      });
    });

    it('returns 7 daily buckets for the selected week and zero-fills gaps', async () => {
      prisma.order.findMany.mockResolvedValue([
        {
          placedAt: new Date('2026-03-30T10:00:00'),
          totalCents: 5000,
        },
        {
          placedAt: new Date('2026-04-01T10:00:00'),
          totalCents: 2500,
        },
      ] as any);

      const result = await service.getSalesOverview('org-1', {
        timeline: DashboardSalesTimeline.WEEK,
      });

      expect(result.timeline).toBe(DashboardSalesTimeline.WEEK);
      expect(result.periodStart).toEqual(new Date('2026-03-30T00:00:00'));
      expect(result.periodEnd).toEqual(new Date('2026-04-06T00:00:00'));
      expect(result.previousAnchor).toEqual(new Date('2026-03-23T00:00:00'));
      expect(result.nextAnchor).toEqual(new Date('2026-04-06T00:00:00'));
      expect(result.isCurrentPeriod).toBe(true);
      expect(result.buckets).toHaveLength(7);
      expect(result.buckets[0]).toEqual(
        expect.objectContaining({ label: 'Mon', salesCents: 5000 }),
      );
      expect(result.buckets[1].salesCents).toBe(0);
      expect(result.buckets[2]).toEqual(
        expect.objectContaining({ label: 'Wed', salesCents: 2500 }),
      );
    });

    it('returns one bucket per day in the selected month', async () => {
      prisma.order.findMany.mockResolvedValue([
        {
          placedAt: new Date('2026-02-01T10:00:00'),
          totalCents: 1500,
        },
        {
          placedAt: new Date('2026-02-28T15:00:00'),
          totalCents: 2200,
        },
      ] as any);

      const result = await service.getSalesOverview('org-1', {
        timeline: DashboardSalesTimeline.MONTH,
        anchor: '2026-02-11T12:00:00',
      });

      expect(result.timeline).toBe(DashboardSalesTimeline.MONTH);
      expect(result.periodStart).toEqual(new Date('2026-02-01T00:00:00'));
      expect(result.periodEnd).toEqual(new Date('2026-03-01T00:00:00'));
      expect(result.isCurrentPeriod).toBe(false);
      expect(result.buckets).toHaveLength(28);
      expect(result.totalSalesCents).toBe(3700);
      expect(result.buckets[0]).toEqual(
        expect.objectContaining({ label: 'Feb 1', salesCents: 1500 }),
      );
      expect(result.buckets[27]).toEqual(
        expect.objectContaining({ label: 'Feb 28', salesCents: 2200 }),
      );
    });

    it('uses placedAt and matching dashboard order statuses only', async () => {
      prisma.order.findMany.mockResolvedValue([] as any);

      await service.getSalesOverview('org-1', {
        timeline: DashboardSalesTimeline.WEEK,
        anchor: '2026-04-15T08:00:00',
      });

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['CONFIRMED', 'FULFILLED'] },
            placedAt: expect.objectContaining({
              gte: new Date('2026-04-13T00:00:00'),
              lt: new Date('2026-04-20T00:00:00'),
            }),
          }),
        }),
      );
    });
  });
});
