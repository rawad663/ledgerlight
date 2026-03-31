import { Controller, ForbiddenException, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OrgProtected } from '@src/common/decorators/auth.decorator';
import {
  CurrentOrganization,
  type CurrentOrg,
} from '@src/common/decorators/current-org.decorator';
import { RequirePermissions } from '@src/common/decorators/permissions.decorator';
import { Permission } from '@src/common/permissions';
import { Role } from '@prisma/generated/enums';
import { ApiDoc } from '@src/common/swagger/api-doc.decorator';
import { DashboardService } from './dashboard.service';
import { DashboardSummaryDto } from './dashboard.dto';

const DASHBOARD_ALLOWED_ROLES = new Set<Role>([Role.OWNER, Role.MANAGER]);

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
  )
  @ApiDoc({
    summary: 'Get dashboard summary',
    description:
      'Returns live dashboard KPI values for managers and owners in the active organization.',
    ok: DashboardSummaryDto,
  })
  getSummary(@CurrentOrganization() organization: CurrentOrg) {
    if (!DASHBOARD_ALLOWED_ROLES.has(organization.role)) {
      throw new ForbiddenException(
        'Dashboard is only available to managers and owners',
      );
    }

    return this.dashboardService.getSummary(organization.organizationId);
  }
}
