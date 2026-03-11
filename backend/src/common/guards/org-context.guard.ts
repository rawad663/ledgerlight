import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { RequestWithUser } from '@src/domain/auth/strategies/jwt.strategy';
import { PrismaService } from '@src/infra/prisma/prisma.service';

const ORGANIZATION_HEADER_KEY = 'x-organization-id';

@Injectable()
export class OrganizationContextGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<RequestWithUser>();
    const orgId = req.headers[ORGANIZATION_HEADER_KEY] as string | undefined;

    if (!orgId) {
      throw new ForbiddenException('X-Organization-Id header is required');
    }

    const membership = req.user.memberships.find(
      (m) => m.organizationId === orgId,
    );

    if (!membership) {
      throw new ForbiddenException(
        'User does not have access to the specified organization',
      );
    }

    req.organization = {
      organizationId: orgId,
      role: membership.role,
    };

    return true;
  }
}
