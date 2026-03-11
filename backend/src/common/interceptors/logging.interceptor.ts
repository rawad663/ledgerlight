// logging.interceptor.ts
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Logger,
} from '@nestjs/common';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { Response } from 'express';
import { RequestWithContext } from '@src/common/middlewares/request-context.middleware';

function sanitizeForLogging(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const clone = { ...body };
  delete clone.password;
  delete clone.accessToken;
  delete clone.refreshTokenRaw;

  return clone;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<RequestWithContext>();
    const res = http.getResponse<Response>();

    return next.handle().pipe(
      tap((responseBody: unknown) => {
        const latencyMs = req.startTime
          ? Number(process.hrtime.bigint() - req.startTime) / 1_000_000
          : undefined;

        // Limit the size of the logged request/response body to prevent excessive log sizes
        const responsePreview = JSON.stringify(
          sanitizeForLogging((responseBody as Record<string, unknown>) ?? {}),
        ).slice(0, 2000);
        const requestBodyPreview = req?.body
          ? JSON.stringify(sanitizeForLogging(req.body)).slice(0, 2000)
          : undefined;

        this.logger.log(
          JSON.stringify({
            request_id: req.requestId,
            method: req.method,
            path: req.originalUrl ?? req.url,
            status: res.statusCode,
            latency_ms: latencyMs?.toFixed(1),
            reqBody: requestBodyPreview,
            resBody: responsePreview,
          }),
        );
      }),
      catchError((error: Error) => {
        const latencyMs = req.startTime
          ? Number(process.hrtime.bigint() - req.startTime) / 1_000_000
          : undefined;

        this.logger.error(
          JSON.stringify({
            request_id: req.requestId,
            method: req.method,
            path: req.originalUrl ?? req.url,
            status: res.statusCode,
            latency_ms: latencyMs?.toFixed(1),
            error: error?.message ?? 'Unknown error',
          }),
        );

        return throwError(() => error);
      }),
    );
  }
}
