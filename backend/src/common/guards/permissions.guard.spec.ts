import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common/interfaces';
import { PermissionsGuard } from './permissions.guard';
import {
  PERMISSIONS_KEY,
  PERMISSIONS_ANY_KEY,
} from '../decorators/permissions.decorator';
import { Permission } from '@src/common/permissions';

const makeCtx = (req: any): Partial<ExecutionContext> =>
  ({
    switchToHttp: () => ({ getRequest: () => req }) as any,
    getHandler: () => ({}) as any,
    getClass: () => ({}) as any,
  }) as any;

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() } as any;
    guard = new PermissionsGuard(reflector);
  });

  // ── Context validation ─────────────────────────────────────────────────

  it('rejects when organization context missing', () => {
    const req = { user: {} } as any;
    expect(() => guard.canActivate(makeCtx(req) as ExecutionContext)).toThrow(
      new ForbiddenException('Organization context is missing'),
    );
  });

  it('rejects when user or memberships missing', () => {
    const req = { organization: { organizationId: 'org-1' } } as any;
    expect(() => guard.canActivate(makeCtx(req) as ExecutionContext)).toThrow(
      new ForbiddenException('User or user memberships not found'),
    );
  });

  it('rejects when membership for org not found', () => {
    const req = {
      organization: { organizationId: 'org-1' },
      user: { memberships: [{ organizationId: 'org-2', role: 'MANAGER' }] },
    } as any;
    expect(() => guard.canActivate(makeCtx(req) as ExecutionContext)).toThrow(
      new ForbiddenException(
        'User does not have access to the specified organization',
      ),
    );
  });

  // ── Default-deny ───────────────────────────────────────────────────────

  it('rejects when no permission metadata declared (default-deny)', () => {
    // Both metadata keys return undefined
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const req = {
      organization: { organizationId: 'org-1' },
      user: { memberships: [{ organizationId: 'org-1', role: 'MANAGER' }] },
    } as any;
    expect(() => guard.canActivate(makeCtx(req) as ExecutionContext)).toThrow(
      new ForbiddenException('No permission declared for this route'),
    );
  });

  it('rejects when both metadata keys return empty arrays (default-deny)', () => {
    reflector.getAllAndOverride.mockReturnValue([]);
    const req = {
      organization: { organizationId: 'org-1' },
      user: { memberships: [{ organizationId: 'org-1', role: 'MANAGER' }] },
    } as any;
    expect(() => guard.canActivate(makeCtx(req) as ExecutionContext)).toThrow(
      new ForbiddenException('No permission declared for this route'),
    );
  });

  // ── OWNER wildcard ─────────────────────────────────────────────────────

  it('OWNER passes any RequirePermissions check (wildcard)', () => {
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === PERMISSIONS_KEY) return [Permission.ROLES_MANAGE];
      return undefined;
    });
    const req = {
      organization: { organizationId: 'org-1' },
      user: { memberships: [{ organizationId: 'org-1', role: 'OWNER' }] },
    } as any;
    expect(guard.canActivate(makeCtx(req) as ExecutionContext)).toBe(true);
  });

  it('OWNER passes any RequireAnyPermission check (wildcard)', () => {
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === PERMISSIONS_ANY_KEY)
        return [Permission.ORDERS_TRANSITION_REFUND];
      return undefined;
    });
    const req = {
      organization: { organizationId: 'org-1' },
      user: { memberships: [{ organizationId: 'org-1', role: 'OWNER' }] },
    } as any;
    expect(guard.canActivate(makeCtx(req) as ExecutionContext)).toBe(true);
  });

  // ── RequirePermissions (AND semantics) ─────────────────────────────────

  it('MANAGER with a permitted permission passes', () => {
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === PERMISSIONS_KEY) return [Permission.CUSTOMERS_CREATE];
      return undefined;
    });
    const req = {
      organization: { organizationId: 'org-1' },
      user: { memberships: [{ organizationId: 'org-1', role: 'MANAGER' }] },
    } as any;
    expect(guard.canActivate(makeCtx(req) as ExecutionContext)).toBe(true);
  });

  it('MANAGER with a restricted permission throws', () => {
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === PERMISSIONS_KEY) return [Permission.ROLES_MANAGE];
      return undefined;
    });
    const req = {
      organization: { organizationId: 'org-1' },
      user: { memberships: [{ organizationId: 'org-1', role: 'MANAGER' }] },
    } as any;
    expect(() => guard.canActivate(makeCtx(req) as ExecutionContext)).toThrow(
      new ForbiddenException('Insufficient permissions'),
    );
  });

  it('CASHIER with orders.create passes', () => {
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === PERMISSIONS_KEY) return [Permission.ORDERS_CREATE];
      return undefined;
    });
    const req = {
      organization: { organizationId: 'org-1' },
      user: { memberships: [{ organizationId: 'org-1', role: 'CASHIER' }] },
    } as any;
    expect(guard.canActivate(makeCtx(req) as ExecutionContext)).toBe(true);
  });

  it('CASHIER with customers.delete throws', () => {
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === PERMISSIONS_KEY) return [Permission.CUSTOMERS_DELETE];
      return undefined;
    });
    const req = {
      organization: { organizationId: 'org-1' },
      user: { memberships: [{ organizationId: 'org-1', role: 'CASHIER' }] },
    } as any;
    expect(() => guard.canActivate(makeCtx(req) as ExecutionContext)).toThrow(
      new ForbiddenException('Insufficient permissions'),
    );
  });

  it('SUPPORT with customers.read passes', () => {
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === PERMISSIONS_KEY) return [Permission.CUSTOMERS_READ];
      return undefined;
    });
    const req = {
      organization: { organizationId: 'org-1' },
      user: { memberships: [{ organizationId: 'org-1', role: 'SUPPORT' }] },
    } as any;
    expect(guard.canActivate(makeCtx(req) as ExecutionContext)).toBe(true);
  });

  it('SUPPORT with customers.create throws', () => {
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === PERMISSIONS_KEY) return [Permission.CUSTOMERS_CREATE];
      return undefined;
    });
    const req = {
      organization: { organizationId: 'org-1' },
      user: { memberships: [{ organizationId: 'org-1', role: 'SUPPORT' }] },
    } as any;
    expect(() => guard.canActivate(makeCtx(req) as ExecutionContext)).toThrow(
      new ForbiddenException('Insufficient permissions'),
    );
  });

  it('INVENTORY_CLERK with inventory.adjust passes', () => {
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === PERMISSIONS_KEY) return [Permission.INVENTORY_ADJUST];
      return undefined;
    });
    const req = {
      organization: { organizationId: 'org-1' },
      user: {
        memberships: [{ organizationId: 'org-1', role: 'INVENTORY_CLERK' }],
      },
    } as any;
    expect(guard.canActivate(makeCtx(req) as ExecutionContext)).toBe(true);
  });

  it('INVENTORY_CLERK with orders.read throws', () => {
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === PERMISSIONS_KEY) return [Permission.ORDERS_READ];
      return undefined;
    });
    const req = {
      organization: { organizationId: 'org-1' },
      user: {
        memberships: [{ organizationId: 'org-1', role: 'INVENTORY_CLERK' }],
      },
    } as any;
    expect(() => guard.canActivate(makeCtx(req) as ExecutionContext)).toThrow(
      new ForbiddenException('Insufficient permissions'),
    );
  });

  // ── RequireAnyPermission (OR semantics) ────────────────────────────────

  it('CASHIER with orders.transition.confirm via RequireAnyPermission passes', () => {
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === PERMISSIONS_ANY_KEY)
        return [
          Permission.ORDERS_TRANSITION_CONFIRM,
          Permission.ORDERS_TRANSITION_FULFILL,
          Permission.ORDERS_TRANSITION_CANCEL,
          Permission.ORDERS_TRANSITION_REOPEN,
          Permission.ORDERS_TRANSITION_REFUND,
        ];
      return undefined;
    });
    const req = {
      organization: { organizationId: 'org-1' },
      user: { memberships: [{ organizationId: 'org-1', role: 'CASHIER' }] },
    } as any;
    // CASHIER has CONFIRM and FULFILL but not CANCEL/REOPEN/REFUND —
    // the OR gate passes because at least one is present.
    expect(guard.canActivate(makeCtx(req) as ExecutionContext)).toBe(true);
  });

  it('SUPPORT with transition RequireAnyPermission throws (no transitions allowed)', () => {
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === PERMISSIONS_ANY_KEY)
        return [
          Permission.ORDERS_TRANSITION_CONFIRM,
          Permission.ORDERS_TRANSITION_FULFILL,
          Permission.ORDERS_TRANSITION_CANCEL,
          Permission.ORDERS_TRANSITION_REOPEN,
          Permission.ORDERS_TRANSITION_REFUND,
        ];
      return undefined;
    });
    const req = {
      organization: { organizationId: 'org-1' },
      user: { memberships: [{ organizationId: 'org-1', role: 'SUPPORT' }] },
    } as any;
    expect(() => guard.canActivate(makeCtx(req) as ExecutionContext)).toThrow(
      new ForbiddenException('Insufficient permissions'),
    );
  });

  it('INVENTORY_CLERK with transition RequireAnyPermission throws', () => {
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === PERMISSIONS_ANY_KEY)
        return [
          Permission.ORDERS_TRANSITION_CONFIRM,
          Permission.ORDERS_TRANSITION_CANCEL,
        ];
      return undefined;
    });
    const req = {
      organization: { organizationId: 'org-1' },
      user: {
        memberships: [{ organizationId: 'org-1', role: 'INVENTORY_CLERK' }],
      },
    } as any;
    expect(() => guard.canActivate(makeCtx(req) as ExecutionContext)).toThrow(
      new ForbiddenException('Insufficient permissions'),
    );
  });
});
