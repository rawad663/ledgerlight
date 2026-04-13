import { Injectable } from '@nestjs/common';
import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
} from 'prom-client';
import { getStatusClass } from './http-observability.util';

const DEFAULT_SLOW_QUERY_THRESHOLD_MS = 250;

@Injectable()
export class MonitoringService {
  private readonly registry = new Registry();
  private readonly defaultMetricsCollection = collectDefaultMetrics({
    prefix: 'ledgerlight_',
    register: this.registry,
  });

  private readonly httpRequestsTotal = new Counter({
    name: 'ledgerlight_http_requests_total',
    help: 'Total number of HTTP requests handled by the backend.',
    labelNames: ['method', 'route', 'status_class'] as const,
    registers: [this.registry],
  });

  private readonly httpRequestDurationSeconds = new Histogram({
    name: 'ledgerlight_http_request_duration_seconds',
    help: 'Duration of handled HTTP requests.',
    labelNames: ['method', 'route', 'status_class'] as const,
    buckets: [0.025, 0.05, 0.1, 0.2, 0.3, 0.5, 1, 2, 5],
    registers: [this.registry],
  });

  private readonly activeRequests = new Gauge({
    name: 'ledgerlight_http_requests_active',
    help: 'Current number of in-flight HTTP requests.',
    labelNames: ['method', 'route'] as const,
    registers: [this.registry],
  });

  private readonly httpErrorsTotal = new Counter({
    name: 'ledgerlight_http_errors_total',
    help: 'Total number of HTTP requests that returned an error status.',
    labelNames: ['method', 'route', 'status_class'] as const,
    registers: [this.registry],
  });

  private readonly authFailuresTotal = new Counter({
    name: 'ledgerlight_auth_failures_total',
    help: 'Authentication failures grouped by auth operation and status class.',
    labelNames: ['operation', 'status_class'] as const,
    registers: [this.registry],
  });

  private readonly orderCreationsTotal = new Counter({
    name: 'ledgerlight_order_creations_total',
    help: 'Successful order creation requests.',
    registers: [this.registry],
  });

  private readonly inventoryAdjustmentsTotal = new Counter({
    name: 'ledgerlight_inventory_adjustments_total',
    help: 'Successful inventory adjustment requests.',
    registers: [this.registry],
  });

  private readonly dbQueriesTotal = new Counter({
    name: 'ledgerlight_db_queries_total',
    help: 'Total number of observed Prisma database queries.',
    labelNames: ['operation'] as const,
    registers: [this.registry],
  });

  private readonly dbQueryDurationSeconds = new Histogram({
    name: 'ledgerlight_db_query_duration_seconds',
    help: 'Observed Prisma database query durations.',
    labelNames: ['operation'] as const,
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2],
    registers: [this.registry],
  });

  private readonly slowQueriesTotal = new Counter({
    name: 'ledgerlight_slow_queries_total',
    help: 'Observed Prisma database queries above the slow-query threshold.',
    labelNames: ['operation'] as const,
    registers: [this.registry],
  });

  getContentType() {
    return this.registry.contentType;
  }

  async getMetrics() {
    return this.registry.metrics();
  }

  incrementActiveRequest(method: string, route: string) {
    this.activeRequests.inc({ method, route });
  }

  decrementActiveRequest(method: string, route: string) {
    this.activeRequests.dec({ method, route });
  }

  recordHttpRequest(args: {
    method: string;
    route: string;
    statusCode: number;
    durationSeconds: number;
  }) {
    const statusClass = getStatusClass(args.statusCode);
    const labels = {
      method: args.method,
      route: args.route,
      status_class: statusClass,
    };

    this.httpRequestsTotal.inc(labels);
    this.httpRequestDurationSeconds.observe(labels, args.durationSeconds);

    if (args.statusCode >= 400) {
      this.httpErrorsTotal.inc(labels);
      this.recordAuthFailure(args.route, statusClass);
    }

    if (
      args.method === 'POST' &&
      args.route === '/orders' &&
      args.statusCode < 400
    ) {
      this.orderCreationsTotal.inc();
    }

    if (
      args.method === 'POST' &&
      args.route === '/inventory/adjustments' &&
      args.statusCode < 400
    ) {
      this.inventoryAdjustmentsTotal.inc();
    }
  }

  recordDbQuery(query: string, durationMs: number) {
    const operation = this.getDbOperation(query);

    this.dbQueriesTotal.inc({ operation });
    this.dbQueryDurationSeconds.observe({ operation }, durationMs / 1000);

    if (durationMs >= this.getSlowQueryThresholdMs()) {
      this.slowQueriesTotal.inc({ operation });
    }
  }

  private recordAuthFailure(route: string, statusClass: string) {
    if (route === '/auth/login') {
      this.authFailuresTotal.inc({
        operation: 'login',
        status_class: statusClass,
      });
    }

    if (route === '/auth/refresh') {
      this.authFailuresTotal.inc({
        operation: 'refresh',
        status_class: statusClass,
      });
    }
  }

  private getDbOperation(query: string): string {
    const operation = query.trim().split(/\s+/)[0]?.toUpperCase();

    switch (operation) {
      case 'SELECT':
      case 'INSERT':
      case 'UPDATE':
      case 'DELETE':
        return operation;
      default:
        return 'OTHER';
    }
  }

  private getSlowQueryThresholdMs() {
    return Number.parseInt(
      process.env.DB_SLOW_QUERY_THRESHOLD_MS ||
        String(DEFAULT_SLOW_QUERY_THRESHOLD_MS),
      10,
    );
  }
}
