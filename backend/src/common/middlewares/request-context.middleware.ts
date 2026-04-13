// request-context.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Request, Response, NextFunction } from 'express';

export interface RequestWithContext extends Request {
  requestId?: string;
  startTime?: bigint;
}

export const REQUEST_HEADER = 'X-Request-Id';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: RequestWithContext, res: Response, next: NextFunction) {
    const requestId = req.get(REQUEST_HEADER) || randomUUID();

    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    req.startTime = process.hrtime.bigint();
    next();
  }
}
