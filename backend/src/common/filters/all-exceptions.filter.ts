// all-exceptions.filter.ts
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { RequestWithContext } from '@src/common/middlewares/request-context.middleware';
import { Prisma } from '@prisma/generated/client';
import {
  getOrganizationId,
  getRouteTemplate,
  getStatusCodeForException,
  type ObservableHttpRequest,
} from '@src/common/monitoring/http-observability.util';
import { writeStructuredLog } from '@src/common/monitoring/structured-log';
import { trace } from '@opentelemetry/api';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<ObservableHttpRequest & RequestWithContext>();
    const res = ctx.getResponse<Response>();
    const status = getStatusCodeForException(exception, res.statusCode);
    const route = getRouteTemplate(req);

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    let message: string = 'Internal server error';

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      if ('message' in exceptionResponse) {
        message = exceptionResponse.message as string;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // Parse Prisma Errors into HTTP errors
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const code = exception.code;
      const status =
        code === 'P2025'
          ? HttpStatus.NOT_FOUND
          : code === 'P2002'
            ? HttpStatus.CONFLICT
            : HttpStatus.BAD_REQUEST;

      const message =
        code === 'P2025'
          ? 'Resource not found'
          : code === 'P2002'
            ? 'Unique constraint violated'
            : exception.message;

      this.logException(req, status, message, exception);
      return res.status(status).json({
        statusCode: status,
        message,
        path: route,
        resourceId: req.params.id ?? null,
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
      });
    }

    this.logException(req, status, message, exception);

    if (status === 500) {
      res.status(status).json({
        statusCode: status,
        message: 'Internal Server Error',
        path: route,
        resourceId: req.params.id ?? null,
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(status).json({
        statusCode: status,
        message,
        path: route,
        resourceId: req.params.id ?? null,
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
      });
    }
  }

  private logException(
    req: ObservableHttpRequest & RequestWithContext,
    status: number,
    message: string,
    exception: unknown,
  ) {
    const latencyMs = req.startTime
      ? Number(process.hrtime.bigint() - req.startTime) / 1_000_000
      : undefined;
    const spanContext = trace.getActiveSpan()?.spanContext();

    writeStructuredLog('error', 'http', {
      message: 'request_failed',
      request_id: req.requestId ?? null,
      resource_id: req.params.id ?? null,
      trace_id: spanContext?.traceId ?? null,
      span_id: spanContext?.spanId ?? null,
      method: req.method,
      route: getRouteTemplate(req),
      status_code: status,
      duration_ms: latencyMs ? Number(latencyMs.toFixed(1)) : null,
      user_id: req.user?.id ?? null,
      organization_id: getOrganizationId(req),
      error: message,
      error_name: exception instanceof Error ? exception.name : 'UnknownError',
    });
  }
}
