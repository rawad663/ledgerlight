import { ForbiddenException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common/interfaces';
import { OrganizationContextGuard } from './org-context.guard';
import { PrismaService } from '@src/prisma/prisma.service';

const makeCtx = (req: any): Partial<ExecutionContext> =>
  ({
    switchToHttp: () => ({ getRequest: () => req }) as any,
  }) as any;

describe('OrganizationContextGuard', () => {
  const guard = new OrganizationContextGuard({} as PrismaService);

  it('rejects when header missing', () => {
    const req = { headers: {}, user: { memberships: [] } } as any;
    const ctx = makeCtx(req);
    expect(() => guard.canActivate(ctx as ExecutionContext)).toThrow(
      new ForbiddenException('X-Organization-Id header is required'),
    );
  });

  it('rejects when user has no membership in org', () => {
    const req = {
      headers: { 'x-organization-id': 'org-1' },
      user: { memberships: [{ organizationId: 'org-2' }] },
    } as any;
    const ctx = makeCtx(req);
    expect(() => guard.canActivate(ctx as ExecutionContext)).toThrow(
      new ForbiddenException(
        'User does not have access to the specified organization',
      ),
    );
  });

  it('sets req.organization and allows when membership exists', () => {
    const req = {
      headers: { 'x-organization-id': 'org-1' },
      user: { memberships: [{ organizationId: 'org-1', role: 'MANAGER' }] },
    } as any;
    const ctx = makeCtx(req);
    expect(guard.canActivate(ctx as ExecutionContext)).toBe(true);
    expect(req.organization).toEqual({
      organizationId: 'org-1',
      role: 'MANAGER',
    });
  });
});
