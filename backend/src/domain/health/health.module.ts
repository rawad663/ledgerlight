import { Module } from '@nestjs/common';
import { MonitoringModule } from '@src/common/monitoring/monitoring.module';
import { HealthController } from './health.controller';
import { MetricsController } from './metrics.controller';
import { PrismaModule } from '@src/infra/prisma/prisma.module';

@Module({
  imports: [PrismaModule, MonitoringModule],
  controllers: [HealthController, MetricsController],
})
export class HealthModule {}
