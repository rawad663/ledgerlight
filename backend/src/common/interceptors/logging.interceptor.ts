// logging.interceptor.ts
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Response } from 'express';
import { RequestWithContext } from '@src/common/middlewares/request-context.middleware';
import {
  getOrganizationId,
  getPaginationCursorPresent,
  getPaginationLimit,
  getRouteTemplate,
  getSearchPresent,
  type ObservableHttpRequest,
} from '@src/common/monitoring/http-observability.util';
import { writeStructuredLog } from '@src/common/monitoring/structured-log';
import { SpanStatusCode, trace } from '@opentelemetry/api';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<ObservableHttpRequest & RequestWithContext>();
    const res = http.getResponse<Response>();
    const route = getRouteTemplate(req);
    const activeSpan = trace.getActiveSpan();
    const organizationId = getOrganizationId(req);
    const userId = req.user?.id ?? null;

    if (activeSpan) {
      activeSpan.setAttributes({
        'app.request_id': req.requestId ?? '',
        'app.organization_id': organizationId ?? '',
        'enduser.id': userId ?? '',
        'app.search_present': getSearchPresent(req),
        'app.pagination.cursor_present': getPaginationCursorPresent(req),
        'http.route': route,
      });

      const paginationLimit = getPaginationLimit(req);
      if (paginationLimit !== null) {
        activeSpan.setAttribute('app.pagination.limit', paginationLimit);
      }
    }

    return next.handle().pipe(
      tap({
        next: () => {
          const latencyMs = req.startTime
            ? Number(process.hrtime.bigint() - req.startTime) / 1_000_000
            : undefined;
          const spanContext = activeSpan?.spanContext();

          writeStructuredLog('info', 'http', {
            message: 'request_completed',
            request_id: req.requestId ?? null,
            trace_id: spanContext?.traceId ?? null,
            span_id: spanContext?.spanId ?? null,
            method: req.method,
            route,
            status_code: res.statusCode,
            duration_ms: latencyMs ? Number(latencyMs.toFixed(1)) : null,
            user_id: userId,
            organization_id: organizationId,
            search_present: getSearchPresent(req),
            pagination_cursor_present: getPaginationCursorPresent(req),
            pagination_limit: getPaginationLimit(req),
          });
        },
        error: (error: Error) => {
          if (activeSpan) {
            activeSpan.recordException(error);
            activeSpan.setStatus({
              code: SpanStatusCode.ERROR,
              message: error.message,
            });
          }
        },
      }),
    );
  }
}
