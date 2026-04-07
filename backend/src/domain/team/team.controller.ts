import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  CurrentOrganization,
  type CurrentOrg,
} from '@src/common/decorators/current-org.decorator';
import { CurrentUser } from '@src/common/decorators/current-user.decorator';
import { OrgProtected } from '@src/common/decorators/auth.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '@src/common/decorators/permissions.decorator';
import { Permission } from '@src/common/permissions';
import { type UserWithMemberships } from '../auth/strategies/jwt.strategy';
import {
  ApiDoc,
  appendToPaginationQuery,
} from '@src/common/swagger/api-doc.decorator';
import {
  GetTeamMembersQueryDto,
  InviteMemberDto,
  TeamMemberDetailDto,
  TeamMembersResponseDto,
  TeamMutationResponseDto,
  TeamRolesResponseDto,
  UpdateTeamMemberDto,
  UpdateTeamMemberLocationsDto,
  UpdateTeamMemberRoleDto,
} from './team.dto';
import { TeamService } from './team.service';

@ApiTags('team')
@Controller('team')
@OrgProtected()
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Get()
  @RequirePermissions(Permission.USERS_READ)
  @ApiDoc({
    summary: 'List team members',
    ok: TeamMembersResponseDto,
    queries: appendToPaginationQuery([
      { name: 'search', description: 'Search by name or email', type: String },
      { name: 'role', description: 'Filter by role', type: String },
      {
        name: 'status',
        description: 'Filter by membership status',
        type: String,
      },
    ]),
  })
  getMembers(
    @CurrentOrganization() organization: CurrentOrg,
    @Query() query: GetTeamMembersQueryDto,
  ) {
    return this.teamService.getMembers(organization, query);
  }

  @Get('roles')
  @RequirePermissions(Permission.USERS_READ)
  @ApiDoc({
    summary: 'Get read-only role catalog',
    ok: TeamRolesResponseDto,
  })
  getRoles(@CurrentOrganization() organization: CurrentOrg) {
    return this.teamService.getRoles(organization.organizationId);
  }

  @Get(':membershipId')
  @RequirePermissions(Permission.USERS_READ)
  @ApiDoc({
    summary: 'Get team member detail',
    ok: TeamMemberDetailDto,
  })
  getMemberDetail(
    @CurrentOrganization() organization: CurrentOrg,
    @Param('membershipId') membershipId: string,
  ) {
    return this.teamService.getMemberDetail(organization, membershipId);
  }

  @Post('invite')
  @RequireAnyPermission(Permission.USERS_INVITE, Permission.USERS_MANAGE)
  @ApiDoc({
    summary: 'Invite a member',
    body: InviteMemberDto,
    created: TeamMutationResponseDto,
  })
  inviteMember(
    @CurrentOrganization() organization: CurrentOrg,
    @CurrentUser() user: UserWithMemberships,
    @Body() input: InviteMemberDto,
  ) {
    return this.teamService.inviteMember(organization, user.id, input);
  }

  @Patch(':membershipId')
  @RequireAnyPermission(Permission.USERS_INVITE, Permission.USERS_MANAGE)
  @ApiDoc({
    summary: 'Update member profile details',
    body: UpdateTeamMemberDto,
    ok: TeamMutationResponseDto,
  })
  updateMember(
    @CurrentOrganization() organization: CurrentOrg,
    @CurrentUser() user: UserWithMemberships,
    @Param('membershipId') membershipId: string,
    @Body() input: UpdateTeamMemberDto,
  ) {
    return this.teamService.updateMember(
      organization,
      user.id,
      membershipId,
      input,
    );
  }

  @Patch(':membershipId/role')
  @RequireAnyPermission(Permission.USERS_INVITE, Permission.USERS_MANAGE)
  @ApiDoc({
    summary: 'Change a member role',
    body: UpdateTeamMemberRoleDto,
    ok: TeamMutationResponseDto,
  })
  updateMemberRole(
    @CurrentOrganization() organization: CurrentOrg,
    @CurrentUser() user: UserWithMemberships,
    @Param('membershipId') membershipId: string,
    @Body() input: UpdateTeamMemberRoleDto,
  ) {
    return this.teamService.updateMemberRole(
      organization,
      user.id,
      membershipId,
      input,
    );
  }

  @Patch(':membershipId/locations')
  @RequireAnyPermission(Permission.USERS_INVITE, Permission.USERS_MANAGE)
  @ApiDoc({
    summary: 'Update a member location scope',
    body: UpdateTeamMemberLocationsDto,
    ok: TeamMutationResponseDto,
  })
  updateMemberLocations(
    @CurrentOrganization() organization: CurrentOrg,
    @CurrentUser() user: UserWithMemberships,
    @Param('membershipId') membershipId: string,
    @Body() input: UpdateTeamMemberLocationsDto,
  ) {
    return this.teamService.updateMemberLocations(
      organization,
      user.id,
      membershipId,
      input,
    );
  }

  @Post(':membershipId/deactivate')
  @RequireAnyPermission(Permission.USERS_INVITE, Permission.USERS_MANAGE)
  @ApiDoc({
    summary: 'Deactivate a member',
    ok: TeamMutationResponseDto,
  })
  deactivateMember(
    @CurrentOrganization() organization: CurrentOrg,
    @CurrentUser() user: UserWithMemberships,
    @Param('membershipId') membershipId: string,
  ) {
    return this.teamService.deactivateMember(
      organization,
      user.id,
      membershipId,
    );
  }

  @Post(':membershipId/reactivate')
  @RequireAnyPermission(Permission.USERS_INVITE, Permission.USERS_MANAGE)
  @ApiDoc({
    summary: 'Reactivate a member',
    ok: TeamMutationResponseDto,
  })
  reactivateMember(
    @CurrentOrganization() organization: CurrentOrg,
    @CurrentUser() user: UserWithMemberships,
    @Param('membershipId') membershipId: string,
  ) {
    return this.teamService.reactivateMember(
      organization,
      user.id,
      membershipId,
    );
  }

  @Post(':membershipId/resend-invite')
  @RequireAnyPermission(Permission.USERS_INVITE, Permission.USERS_MANAGE)
  @ApiDoc({
    summary: 'Resend an invitation',
    ok: TeamMutationResponseDto,
  })
  resendInvite(
    @CurrentOrganization() organization: CurrentOrg,
    @CurrentUser() user: UserWithMemberships,
    @Param('membershipId') membershipId: string,
  ) {
    return this.teamService.resendInvite(organization, user.id, membershipId);
  }
}
