import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common/interfaces';
import { RolesGuard } from './role.guard';

const makeCtx = (req: any): Partial<ExecutionContext> =>
  ({
    switchToHttp: () => ({ getRequest: () => req }) as any,
    getHandler: () => ({}) as any,
    getClass: () => ({}) as any,
  }) as any;

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() } as any;
    guard = new RolesGuard(reflector);
  });

  it('rejects when organization context missing', () => {
    const req = { user: {} } as any;
    const ctx = makeCtx(req);
    expect(() => guard.canActivate(ctx as ExecutionContext)).toThrow(
      new ForbiddenException('Organization context is missing'),
    );
  });

  it('rejects when user or memberships missing', () => {
    const req = { organization: { organizationId: 'org' } } as any;
    const ctx = makeCtx(req);
    expect(() => guard.canActivate(ctx as ExecutionContext)).toThrow(
      new ForbiddenException('User or user memberships not found'),
    );
  });

  it('rejects when membership for org not found', () => {
    const req = {
      organization: { organizationId: 'org-1' },
      user: { memberships: [{ organizationId: 'org-2' }] },
    } as any;
    const ctx = makeCtx(req);
    expect(() => guard.canActivate(ctx as ExecutionContext)).toThrow(
      new ForbiddenException(
        'User does not have access to the specified organization',
      ),
    );
  });

  it('allows when no required roles', () => {
    reflector.getAllAndOverride.mockReturnValueOnce([]);
    const req = {
      organization: { organizationId: 'org-1' },
      user: { memberships: [{ organizationId: 'org-1', role: 'MEMBER' }] },
    } as any;
    const ctx = makeCtx(req);
    expect(guard.canActivate(ctx as ExecutionContext)).toBe(true);
  });

  it('allows when membership has one of required roles', () => {
    reflector.getAllAndOverride.mockReturnValueOnce([
      'ADMIN',
      'MANAGER',
    ] as any);
    const req = {
      organization: { organizationId: 'org-1' },
      user: { memberships: [{ organizationId: 'org-1', role: 'MANAGER' }] },
    } as any;
    const ctx = makeCtx(req);
    expect(guard.canActivate(ctx as ExecutionContext)).toBe(true);
  });

  it('rejects when role insufficient', () => {
    reflector.getAllAndOverride.mockReturnValueOnce(['ADMIN'] as any);
    const req = {
      organization: { organizationId: 'org-1' },
      user: { memberships: [{ organizationId: 'org-1', role: 'MEMBER' }] },
    } as any;
    const ctx = makeCtx(req);
    expect(() => guard.canActivate(ctx as ExecutionContext)).toThrow(
      new ForbiddenException('Insufficient role'),
    );
  });
});
