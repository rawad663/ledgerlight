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
    summary: 'Health check',
    description: 'Database connectivity check',
  })
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok' };
  }

  @Get('base')
  @ApiDoc({
    summary: 'Base health',
    description: 'Basic service liveness',
  })
  check() {
    return { status: 'ok' };
  }
}
