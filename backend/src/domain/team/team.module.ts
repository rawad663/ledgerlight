import { Module } from '@nestjs/common';
import { PrismaModule } from '@src/infra/prisma/prisma.module';
import { TeamController } from './team.controller';
import { TeamInvitationController } from './team-invitation.controller';
import { TeamService } from './team.service';

@Module({
  imports: [PrismaModule],
  controllers: [TeamController, TeamInvitationController],
  providers: [TeamService],
  exports: [TeamService],
})
export class TeamModule {}
