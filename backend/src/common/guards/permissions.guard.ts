import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  PERMISSIONS_KEY,
  PERMISSIONS_ANY_KEY,
} from '../decorators/permissions.decorator';
import { RequestWithUser } from '@src/domain/auth/strategies/jwt.strategy';
import { ROLE_PERMISSIONS, WILDCARD_PERMISSION } from '@src/common/permissions';
import { type Permission } from '@src/common/permissions';
import { Role } from '@prisma/generated/enums';

/**
 * Returns true if the given role has the specified permission.
 * Exported for use in controller-level fine-grained checks (e.g. transition-status).
 */
export function hasPermission(role: Role, permission: Permission): boolean {
  const rolePerms = ROLE_PERMISSIONS[role] ?? [];
  return (
    rolePerms.includes(WILDCARD_PERMISSION) || rolePerms.includes(permission)
  );
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<RequestWithUser>();
    const orgId = req.organization?.organizationId;

    if (!orgId) {
      throw new ForbiddenException('Organization context is missing');
    }

    if (!req.user?.memberships) {
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

    const required = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );

    const requiredAny = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_ANY_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );

    const hasRequired = required && required.length > 0;
    const hasRequiredAny = requiredAny && requiredAny.length > 0;

    // Default-deny: every org-protected route must declare its permission
    if (!hasRequired && !hasRequiredAny) {
      throw new ForbiddenException('No permission declared for this route');
    }

    const rolePerms = ROLE_PERMISSIONS[membership.role] ?? [];

    // OWNER wildcard bypasses all further checks
    if (rolePerms.includes(WILDCARD_PERMISSION)) return true;

    // AND check: all listed permissions required
    if (hasRequired) {
      const ok = required.every((p) => rolePerms.includes(p));
      if (!ok) throw new ForbiddenException('Insufficient permissions');
    }

    // OR check: at least one listed permission required
    if (hasRequiredAny) {
      const ok = requiredAny.some((p) => rolePerms.includes(p));
      if (!ok) throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
