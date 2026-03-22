// all-exceptions.filter.ts
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { RequestWithContext } from '@src/common/middlewares/request-context.middleware';
import { Prisma } from '@prisma/generated/client';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<RequestWithContext>();
    const res = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

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

      this.logger.error(
        JSON.stringify({
          request_id: req.requestId,
          method: req.method,
          path: req.originalUrl ?? req.url,
          status,
          error: message,
        }),
      );
      return res.status(status).json({
        statusCode: status,
        message,
        path: req.originalUrl ?? req.url,
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
      });
    }

    this.logger.error(
      JSON.stringify({
        request_id: req.requestId,
        method: req.method,
        path: req.originalUrl ?? req.url,
        status,
        error: message,
      }),
    );

    res.status(status).json({
      statusCode: status,
      message,
      path: req.originalUrl ?? req.url,
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
    });
  }
}
