import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '@src/infra/prisma/prisma.service';
import { ApiDoc } from '@src/common/swagger/api-doc.decorator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @ApiDoc({
    summary: 'Readiness health check',
    description: 'Database connectivity check for readiness probes',
  })
  async health() {
    return this.ready();
  }

  @Get('ready')
  @ApiDoc({
    summary: 'Readiness health check',
    description: 'Database connectivity check for readiness probes',
  })
  async ready() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok' };
  }

  @Get('base')
  @ApiDoc({
    summary: 'Base health',
    description: 'Basic service liveness alias',
  })
  check() {
    return this.live();
  }

  @Get('live')
  @ApiDoc({
    summary: 'Liveness health check',
    description: 'Basic service liveness without database access',
  })
  live() {
    return { status: 'ok' };
  }
}
