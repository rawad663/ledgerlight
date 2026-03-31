import { Injectable } from '@nestjs/common';
import { PrismaService } from '@src/infra/prisma/prisma.service';
import { CustomerStatus } from '@prisma/generated/client';
import { OrderStatus } from '@prisma/generated/enums';
import { DashboardSummaryDto } from './dashboard.dto';
import { InventoryService } from '../inventory/inventory.service';

const DASHBOARD_ORDER_STATUSES = [OrderStatus.CONFIRMED, OrderStatus.FULFILLED];

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
}
