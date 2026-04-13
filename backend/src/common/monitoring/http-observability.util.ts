import { HttpException, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/generated/client';
import { type Request } from 'express';
import { type RequestWithContext } from '@src/common/middlewares/request-context.middleware';
import { type RequestWithUser } from '@src/domain/auth/strategies/jwt.strategy';

export type ObservableHttpRequest = Request &
  Partial<RequestWithContext> &
  Partial<RequestWithUser>;

export function getRouteTemplate(req: ObservableHttpRequest): string {
  const route = (req.route as { path?: string } | undefined)?.path;
  const baseUrl = req.baseUrl ?? '';

  if (route) {
    return `${baseUrl}${route}` || route;
  }

  return (req.originalUrl ?? req.url).split('?')[0] || '/';
}

export function getStatusClass(statusCode: number): string {
  return `${Math.floor(statusCode / 100)}xx`;
}

export function getStatusCodeForException(
  exception: unknown,
  fallbackStatusCode: number = HttpStatus.INTERNAL_SERVER_ERROR,
): number {
  if (exception instanceof HttpException) {
    return exception.getStatus();
  }

  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    if (exception.code === 'P2025') {
      return HttpStatus.NOT_FOUND;
    }

    if (exception.code === 'P2002') {
      return HttpStatus.CONFLICT;
    }

    return HttpStatus.BAD_REQUEST;
  }

  if (fallbackStatusCode >= 400) {
    return fallbackStatusCode;
  }

  return HttpStatus.INTERNAL_SERVER_ERROR;
}

export function getOrganizationId(req: ObservableHttpRequest): string | null {
  return (
    req.organization?.organizationId ??
    req.headers['x-organization-id']?.toString() ??
    null
  );
}

export function getSearchPresent(req: ObservableHttpRequest): boolean {
  const search = req.query?.search;
  return Array.isArray(search) ? search.some(Boolean) : Boolean(search);
}

export function getPaginationLimit(req: ObservableHttpRequest): number | null {
  const limit = req.query?.limit;
  const normalized = Array.isArray(limit) ? limit[0] : limit;
  if (typeof normalized !== 'string' && typeof normalized !== 'number') {
    return null;
  }

  const parsed = Number.parseInt(String(normalized), 10);

  return Number.isFinite(parsed) ? parsed : null;
}

export function getPaginationCursorPresent(
  req: ObservableHttpRequest,
): boolean {
  const cursor = req.query?.cursor;
  return Array.isArray(cursor) ? cursor.some(Boolean) : Boolean(cursor);
}
