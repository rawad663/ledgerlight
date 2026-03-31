import { Controller, Get } from '@nestjs/common';
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
import { DashboardSummaryDto } from './dashboard.dto';

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
}
