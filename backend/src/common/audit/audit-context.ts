import { RequestWithContext } from '@src/common/middlewares/request-context.middleware';
import { RequestWithUser } from '@src/domain/auth/strategies/jwt.strategy';

export type AuditContext = {
  actorUserId?: string | null;
  requestId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

export function buildAuditContext(
  req: Partial<RequestWithUser & RequestWithContext>,
  actorUserId?: string | null,
): AuditContext {
  return {
    actorUserId: actorUserId ?? null,
    requestId: req.requestId ?? null,
    ip: req.ip ?? null,
    userAgent: req.headers?.['user-agent']?.toString() ?? null,
  };
}
