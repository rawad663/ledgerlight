import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApiDoc } from '@src/common/swagger/api-doc.decorator';
import { CurrentUser } from '@src/common/decorators/current-user.decorator';
import { OptionalJwtAuthGuard } from '@src/common/guards';
import { type UserWithMemberships } from '../auth/strategies/jwt.strategy';
import {
  AcceptInviteDto,
  AcceptInviteResponseDto,
  InvitationResolutionDto,
  ResolveInviteDto,
} from './team.dto';
import { TeamService } from './team.service';

@ApiTags('team')
@Controller('team/invitations')
export class TeamInvitationController {
  constructor(private readonly teamService: TeamService) {}

  @Post('resolve')
  @ApiDoc({
    summary: 'Resolve an invitation token',
    body: ResolveInviteDto,
    ok: InvitationResolutionDto,
  })
  resolve(@Body() input: ResolveInviteDto) {
    return this.teamService.resolveInvitation(input);
  }

  @Post('accept')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiDoc({
    summary: 'Accept an invitation token',
    body: AcceptInviteDto,
    ok: AcceptInviteResponseDto,
  })
  accept(
    @Body() input: AcceptInviteDto,
    @CurrentUser() user?: UserWithMemberships,
  ) {
    return this.teamService.acceptInvitation(input, user?.id);
  }
}
