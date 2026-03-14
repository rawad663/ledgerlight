import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { RequestWithUser } from '@src/domain/auth/strategies/jwt.strategy';

export type CurrentOrg = NonNullable<RequestWithUser['organization']>;

/**
 * Injects the verified organization from the request.
 * Requires Org Context to be active (e.g., via @OrgProtected(), or @Authorized()).
 * View ./auth.decorator.ts
 */
export const CurrentOrganization = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<RequestWithUser>();

    if (!req.organization) {
      throw new ForbiddenException('Organization context is missing');
    }

    return req.organization;
  },
);
