import { Controller, Get, Logger, Request } from '@nestjs/common';
import { AppService } from './app.service';
import type { RequestWithUser } from './domain/auth/strategies/jwt.strategy';
import { Authorized } from '@src/common/decorators/auth.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Authorized('MANAGER', 'SUPPORT')
  getHello(@Request() req: RequestWithUser): string {
    Logger.debug('Request user:', req.user);
    Logger.debug('Request organization:', req.organization);

    return this.appService.getHello();
  }
}
