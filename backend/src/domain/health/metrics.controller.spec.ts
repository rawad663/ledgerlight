import { Test } from '@nestjs/testing';
import { MonitoringService } from '@src/common/monitoring/monitoring.service';
import { MetricsController } from './metrics.controller';

describe('MetricsController', () => {
  let controller: MetricsController;
  const monitoring = {
    getContentType: jest.fn(),
    getMetrics: jest.fn(),
  } as any;

  beforeEach(async () => {
    monitoring.getContentType.mockReturnValue('text/plain');
    monitoring.getMetrics.mockResolvedValue(
      'ledgerlight_http_requests_total 1',
    );

    const module = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [{ provide: MonitoringService, useValue: monitoring }],
    }).compile();

    controller = module.get(MetricsController);
  });

  it('returns Prometheus-formatted metrics output', async () => {
    const response = {
      setHeader: jest.fn(),
      send: jest.fn(),
    } as any;

    await controller.metrics(response);

    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/plain',
    );
    expect(response.send).toHaveBeenCalledWith(
      'ledgerlight_http_requests_total 1',
    );
  });
});
