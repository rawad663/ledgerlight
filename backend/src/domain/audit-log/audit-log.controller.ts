import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OrgProtected } from '@src/common/decorators/auth.decorator';
import { RequirePermissions } from '@src/common/decorators/permissions.decorator';
import { Permission } from '@src/common/permissions';
import {
  CurrentOrganization,
  type CurrentOrg,
} from '@src/common/decorators/current-org.decorator';
import { AuditLogService } from './audit-log.service';
import { GetAuditLogsQueryDto, GetAuditLogsResponseDto } from './audit-log.dto';
import {
  ApiDoc,
  appendToPaginationQuery,
} from '@src/common/swagger/api-doc.decorator';
import { AuditEntityType } from '@prisma/generated/enums';

@Controller('audit-logs')
@OrgProtected()
@ApiTags('audit-logs')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @RequirePermissions(Permission.AUDIT_LOGS_READ)
  @ApiDoc({
    summary: 'List audit logs',
    description:
      'Paginated list of audit log entries for the active organization.',
    ok: GetAuditLogsResponseDto,
    queries: appendToPaginationQuery([
      {
        name: 'entityType',
        description: 'Filter by entity type',
        type: String,
        enum: Object.values(AuditEntityType),
      },
      {
        name: 'entityId',
        description: 'Filter by entity ID',
        type: String,
      },
    ]),
  })
  getAuditLogs(
    @CurrentOrganization() org: CurrentOrg,
    @Query() query: GetAuditLogsQueryDto,
  ) {
    return this.auditLogService.getAuditLogs(org.organizationId, query);
  }
}
