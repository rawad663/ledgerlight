import { MonitoringService } from './monitoring.service';

describe('MonitoringService', () => {
  let service: MonitoringService;

  beforeEach(() => {
    service = new MonitoringService();
  });

  it('records HTTP, auth, and domain counters', async () => {
    service.recordHttpRequest({
      method: 'POST',
      route: '/auth/refresh',
      statusCode: 401,
      durationSeconds: 0.12,
    });
    service.recordHttpRequest({
      method: 'POST',
      route: '/orders',
      statusCode: 201,
      durationSeconds: 0.22,
    });
    service.recordHttpRequest({
      method: 'POST',
      route: '/inventory/adjustments',
      statusCode: 200,
      durationSeconds: 0.11,
    });

    const metrics = await service.getMetrics();

    expect(metrics).toContain('ledgerlight_http_requests_total');
    expect(metrics).toContain('route="/auth/refresh"');
    expect(metrics).toContain('ledgerlight_auth_failures_total');
    expect(metrics).toContain('operation="refresh"');
    expect(metrics).toContain('ledgerlight_order_creations_total 1');
    expect(metrics).toContain('ledgerlight_inventory_adjustments_total 1');
  });

  it('records database query counts, latency, and slow-query totals', async () => {
    process.env.DB_SLOW_QUERY_THRESHOLD_MS = '100';

    service.recordDbQuery('SELECT * FROM "Order"', 80);
    service.recordDbQuery('UPDATE "Order" SET status = $1', 150);

    const metrics = await service.getMetrics();

    expect(metrics).toContain('ledgerlight_db_queries_total');
    expect(metrics).toContain('operation="SELECT"');
    expect(metrics).toContain('operation="UPDATE"');
    expect(metrics).toContain('ledgerlight_slow_queries_total');
    expect(metrics).toContain(
      'ledgerlight_slow_queries_total{operation="UPDATE"} 1',
    );
  });
});
