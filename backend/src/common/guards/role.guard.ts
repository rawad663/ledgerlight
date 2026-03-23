import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import {
  RequestWithUser,
  JwtMembership,
} from '@src/domain/auth/strategies/jwt.strategy';
import { Role } from '@prisma/generated/client';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<RequestWithUser>();
    const orgId = req.organization?.organizationId;

    if (!orgId) {
      throw new ForbiddenException('Organization context is missing');
    }

    if (!req.user || !req.user.memberships) {
      throw new ForbiddenException('User or user memberships not found');
    }

    const membership = req.user.memberships.find(
      (m) => m.organizationId === orgId,
    );

    if (!membership) {
      throw new ForbiddenException(
        'User does not have access to the specified organization',
      );
    }

    const requiredRoles =
      this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
        ctx.getHandler(),
        ctx.getClass(),
      ]) ?? [];

    this.validateRoles(membership, requiredRoles);

    return true;
  }

  validateRoles(membership: JwtMembership, requiredRoles: Role[]): void {
    if (requiredRoles.length === 0) return;

    const ok = requiredRoles.some((r) => membership.role === r);

    if (!ok) throw new ForbiddenException('Insufficient role');
  }
}
