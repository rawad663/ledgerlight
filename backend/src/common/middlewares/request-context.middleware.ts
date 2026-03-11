// request-context.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Request, Response, NextFunction } from 'express';

export interface RequestWithContext extends Request {
  requestId?: string;
  startTime?: bigint;
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: RequestWithContext, _res: Response, next: NextFunction) {
    req.requestId = req.headers['x-request-id']?.toString() || randomUUID();
    req.startTime = process.hrtime.bigint();
    next();
  }
}
