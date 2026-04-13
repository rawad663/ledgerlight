import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Response } from 'express';
import { Observable, catchError, finalize, throwError } from 'rxjs';
import {
  type ObservableHttpRequest,
  getRouteTemplate,
  getStatusCodeForException,
} from '@src/common/monitoring/http-observability.util';
import { MonitoringService } from '@src/common/monitoring/monitoring.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly monitoring: MonitoringService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<ObservableHttpRequest>();
    const res = http.getResponse<Response>();
    const method = req.method;
    const route = getRouteTemplate(req);
    const startedAt = process.hrtime.bigint();
    let thrownError: unknown;

    this.monitoring.incrementActiveRequest(method, route);

    return next.handle().pipe(
      catchError((error: unknown) => {
        thrownError = error;
        return throwError(() => error);
      }),
      finalize(() => {
        const durationSeconds =
          Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
        const statusCode = thrownError
          ? getStatusCodeForException(thrownError, res.statusCode)
          : res.statusCode;

        this.monitoring.recordHttpRequest({
          method,
          route,
          statusCode,
          durationSeconds,
        });
        this.monitoring.decrementActiveRequest(method, route);
      }),
    );
  }
}
