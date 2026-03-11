import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestWithUser } from '@src/domain/auth/strategies/jwt.strategy';

/**
 * Injects the authenticated user from the request.
 * Requires JWT auth to be active (e.g., via @Authenticated(), @OrgProtected(), or @Authorized()).
 * View ./auth.decorator.ts
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<RequestWithUser>();

    return req.user;
  },
);
