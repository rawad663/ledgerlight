import { Injectable } from '@nestjs/common';
import { PrismaService } from '@src/infra/prisma/prisma.service';
import { CustomerStatus } from '@prisma/generated/client';
import { OrderStatus } from '@prisma/generated/enums';
import {
  DashboardSalesBucketDto,
  DashboardSalesOverviewDto,
  DashboardSalesOverviewQueryDto,
  DashboardSalesTimeline,
  DashboardSummaryDto,
} from './dashboard.dto';
import { InventoryService } from '../inventory/inventory.service';

const DASHBOARD_ORDER_STATUSES = [OrderStatus.CONFIRMED, OrderStatus.FULFILLED];
const HOUR_IN_MS = 60 * 60 * 1000;
const DAY_IN_MS = 24 * HOUR_IN_MS;

type SalesPeriod = {
  anchor: Date;
  periodStart: Date;
  periodEnd: Date;
  previousAnchor: Date;
  nextAnchor: Date;
  currentPeriodStart: Date;
};

@Injectable()
export class DashboardService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {}

  async getSummary(organizationId: string): Promise<DashboardSummaryDto> {
    const todayRange = this.getTodayDateRange();

    const [
      todaysSales,
      ordersTodayCount,
      lowStockItemsCount,
      activeCustomersCount,
    ] = await Promise.all([
      this.prismaService.order.aggregate({
        where: {
          organizationId,
          status: { in: DASHBOARD_ORDER_STATUSES },
          placedAt: todayRange,
        },
        _sum: {
          totalCents: true,
        },
      }),
      this.prismaService.order.count({
        where: {
          organizationId,
          status: { in: DASHBOARD_ORDER_STATUSES },
          placedAt: todayRange,
        },
      }),
      this.inventoryService.getLowStockProductCount(organizationId),
      this.prismaService.customer.count({
        where: {
          organizationId,
          status: CustomerStatus.ACTIVE,
        },
      }),
    ]);

    return {
      todaysSalesCents: todaysSales._sum.totalCents ?? 0,
      ordersTodayCount,
      lowStockItemsCount,
      activeCustomersCount,
    };
  }

  async getSalesOverview(
    organizationId: string,
    query: DashboardSalesOverviewQueryDto,
  ): Promise<DashboardSalesOverviewDto> {
    const timeline = query.timeline ?? DashboardSalesTimeline.WEEK;
    const anchor = query.anchor ? new Date(query.anchor) : new Date();
    const period = this.resolveSalesPeriod(timeline, anchor);
    const buckets = this.buildSalesBuckets(timeline, period);

    const orders = await this.prismaService.order.findMany({
      where: {
        organizationId,
        status: { in: DASHBOARD_ORDER_STATUSES },
        placedAt: {
          gte: period.periodStart,
          lt: period.periodEnd,
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

    let totalSalesCents = 0;

    for (const order of orders) {
      if (!order.placedAt) {
        continue;
      }

      const bucketIndex = this.getBucketIndex(
        timeline,
        period.periodStart,
        order.placedAt,
      );

      if (bucketIndex < 0 || bucketIndex >= buckets.length) {
        continue;
      }

      buckets[bucketIndex].salesCents += order.totalCents;
      totalSalesCents += order.totalCents;
    }

    return {
      timeline,
      anchor: period.anchor,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      previousAnchor: period.previousAnchor,
      nextAnchor: period.nextAnchor,
      isCurrentPeriod:
        period.periodStart.getTime() === period.currentPeriodStart.getTime(),
      totalSalesCents,
      buckets,
    };
  }

  private getTodayDateRange() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    return {
      gte: start,
      lt: end,
    };
  }

  private resolveSalesPeriod(
    timeline: DashboardSalesTimeline,
    anchor: Date,
  ): SalesPeriod {
    switch (timeline) {
      case DashboardSalesTimeline.DAY:
        return this.resolveDayPeriod(anchor);
      case DashboardSalesTimeline.MONTH:
        return this.resolveMonthPeriod(anchor);
      case DashboardSalesTimeline.WEEK:
      default:
        return this.resolveWeekPeriod(anchor);
    }
  }

  private resolveDayPeriod(anchor: Date): SalesPeriod {
    const periodStart = this.startOfDay(anchor);
    const periodEnd = this.addDays(periodStart, 1);
    const currentPeriodStart = this.startOfDay(new Date());

    return {
      anchor: periodStart,
      periodStart,
      periodEnd,
      previousAnchor: this.addDays(periodStart, -1),
      nextAnchor: this.addDays(periodStart, 1),
      currentPeriodStart,
    };
  }

  private resolveWeekPeriod(anchor: Date): SalesPeriod {
    const periodStart = this.startOfWeek(anchor);
    const periodEnd = this.addDays(periodStart, 7);
    const currentPeriodStart = this.startOfWeek(new Date());

    return {
      anchor: periodStart,
      periodStart,
      periodEnd,
      previousAnchor: this.addDays(periodStart, -7),
      nextAnchor: this.addDays(periodStart, 7),
      currentPeriodStart,
    };
  }

  private resolveMonthPeriod(anchor: Date): SalesPeriod {
    const periodStart = this.startOfMonth(anchor);
    const periodEnd = this.addMonths(periodStart, 1);
    const currentPeriodStart = this.startOfMonth(new Date());

    return {
      anchor: periodStart,
      periodStart,
      periodEnd,
      previousAnchor: this.addMonths(periodStart, -1),
      nextAnchor: this.addMonths(periodStart, 1),
      currentPeriodStart,
    };
  }

  private buildSalesBuckets(
    timeline: DashboardSalesTimeline,
    period: SalesPeriod,
  ): DashboardSalesBucketDto[] {
    if (timeline === DashboardSalesTimeline.DAY) {
      return Array.from({ length: 24 }, (_, hourIndex) => {
        const bucketStart = new Date(
          period.periodStart.getFullYear(),
          period.periodStart.getMonth(),
          period.periodStart.getDate(),
          hourIndex,
        );

        return {
          bucketStart,
          bucketEnd: new Date(bucketStart.getTime() + HOUR_IN_MS),
          label: bucketStart.toLocaleTimeString('en-US', {
            hour: 'numeric',
          }),
          salesCents: 0,
        };
      });
    }

    const bucketCount = this.getCalendarDayDifference(
      period.periodStart,
      period.periodEnd,
    );

    return Array.from({ length: bucketCount }, (_, dayIndex) => {
      const bucketStart = this.addDays(period.periodStart, dayIndex);
      const label =
        timeline === DashboardSalesTimeline.WEEK
          ? bucketStart.toLocaleDateString('en-US', { weekday: 'short' })
          : bucketStart.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            });

      return {
        bucketStart,
        bucketEnd: this.addDays(bucketStart, 1),
        label,
        salesCents: 0,
      };
    });
  }

  private getBucketIndex(
    timeline: DashboardSalesTimeline,
    periodStart: Date,
    placedAt: Date,
  ): number {
    if (timeline === DashboardSalesTimeline.DAY) {
      return placedAt.getHours();
    }

    return this.getCalendarDayDifference(periodStart, placedAt);
  }

  private startOfDay(date: Date): Date {
    const value = new Date(date);
    value.setHours(0, 0, 0, 0);
    return value;
  }

  private startOfWeek(date: Date): Date {
    const value = this.startOfDay(date);
    const dayOfWeek = value.getDay();
    const offset = (dayOfWeek + 6) % 7;
    value.setDate(value.getDate() - offset);
    return value;
  }

  private startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  private addDays(date: Date, days: number): Date {
    const value = new Date(date);
    value.setDate(value.getDate() + days);
    return value;
  }

  private addMonths(date: Date, months: number): Date {
    return new Date(date.getFullYear(), date.getMonth() + months, 1);
  }

  private getCalendarDayDifference(start: Date, end: Date): number {
    const startUtc = Date.UTC(
      start.getFullYear(),
      start.getMonth(),
      start.getDate(),
    );
    const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());

    return Math.round((endUtc - startUtc) / DAY_IN_MS);
  }
}
