import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OrgProtected } from '@src/common/decorators/auth.decorator';
import {
  CurrentOrganization,
  type CurrentOrg,
} from '@src/common/decorators/current-org.decorator';
import { RequirePermissions } from '@src/common/decorators/permissions.decorator';
import { Permission } from '@src/common/permissions';
import { ApiDoc } from '@src/common/swagger/api-doc.decorator';
import { DashboardService } from './dashboard.service';
import {
  DashboardSalesOverviewDto,
  DashboardSalesOverviewQueryDto,
  DashboardSalesTimeline,
  DashboardSummaryDto,
} from './dashboard.dto';

@Controller('dashboard')
@OrgProtected()
@ApiTags('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @RequirePermissions(
    Permission.ORDERS_READ,
    Permission.CUSTOMERS_READ,
    Permission.INVENTORY_READ,
    Permission.REPORTS_READ,
  )
  @ApiDoc({
    summary: 'Get dashboard summary',
    description:
      'Returns live dashboard KPI values for managers and owners in the active organization.',
    ok: DashboardSummaryDto,
  })
  getSummary(@CurrentOrganization() organization: CurrentOrg) {
    return this.dashboardService.getSummary(organization.organizationId);
  }

  @Get('sales-overview')
  @RequirePermissions(
    Permission.ORDERS_READ,
    Permission.CUSTOMERS_READ,
    Permission.INVENTORY_READ,
    Permission.REPORTS_READ,
  )
  @ApiDoc({
    summary: 'Get dashboard sales overview',
    description:
      'Returns sales totals bucketed by calendar day, week, or month for the active organization.',
    ok: DashboardSalesOverviewDto,
    queries: [
      {
        name: 'timeline',
        description: 'Calendar timeline to visualize sales for.',
        type: String,
        enum: Object.values(DashboardSalesTimeline),
        required: false,
      },
      {
        name: 'anchor',
        description:
          'Optional ISO datetime used to resolve the requested calendar period.',
        type: String,
      },
    ],
  })
  getSalesOverview(
    @CurrentOrganization() organization: CurrentOrg,
    @Query() query: DashboardSalesOverviewQueryDto,
  ) {
    return this.dashboardService.getSalesOverview(
      organization.organizationId,
      query,
    );
  }
}
