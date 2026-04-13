import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { MonitoringService } from '@src/common/monitoring/monitoring.service';

@Controller()
export class MetricsController {
  constructor(private readonly monitoring: MonitoringService) {}

  @Get('metrics')
  async metrics(@Res() response: Response) {
    response.setHeader('Content-Type', this.monitoring.getContentType());
    response.send(await this.monitoring.getMetrics());
  }
}
