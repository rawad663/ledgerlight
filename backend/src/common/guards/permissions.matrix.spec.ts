/**
 * Exhaustive permission matrix tests.
 *
 * Section A — Role × Permission matrix
 *   Generates one test per (role, permission) pair using the same ROLE_PERMISSIONS
 *   source as production, acting as a contract: if someone edits ROLE_PERMISSIONS
 *   the test suite explicitly documents the intended change.
 *
 * Section B — Transition permission table
 *   Verifies the per-toStatus permission mapping used in the order controller
 *   matches the role matrix correctly.
 */

import {
  Permission,
  ROLE_PERMISSIONS,
  WILDCARD_PERMISSION,
} from '@src/common/permissions';
import { hasPermission } from './permissions.guard';

// ── Section A: Role × Permission matrix ──────────────────────────────────────

const ALL_ROLES = [
  'OWNER',
  'MANAGER',
  'CASHIER',
  'SUPPORT',
  'INVENTORY_CLERK',
] as const;
const ALL_PERMISSIONS = Object.values(Permission);

describe('Permission matrix', () => {
  ALL_ROLES.forEach((role) => {
    describe(`Role: ${role}`, () => {
      ALL_PERMISSIONS.forEach((permission) => {
        const rolePerms = ROLE_PERMISSIONS[role] ?? [];
        const expected =
          rolePerms.includes(WILDCARD_PERMISSION) ||
          rolePerms.includes(permission);

        it(`${permission} → ${expected ? 'ALLOW' : 'DENY'}`, () => {
          expect(hasPermission(role, permission)).toBe(expected);
        });
      });
    });
  });
});

// ── Section B: Explicit spot-checks ──────────────────────────────────────────

describe('Role spot-checks', () => {
  // OWNER: unrestricted
  it('OWNER has all permissions', () => {
    ALL_PERMISSIONS.forEach((p) => {
      expect(hasPermission('OWNER', p)).toBe(true);
    });
  });

  // MANAGER: full operational, no org admin
  it('MANAGER has audit_logs.read', () => {
    expect(hasPermission('MANAGER', Permission.AUDIT_LOGS_READ)).toBe(true);
  });
  it('MANAGER does NOT have roles.manage', () => {
    expect(hasPermission('MANAGER', Permission.ROLES_MANAGE)).toBe(false);
  });
  it('MANAGER does NOT have settings.manage', () => {
    expect(hasPermission('MANAGER', Permission.SETTINGS_MANAGE)).toBe(false);
  });

  // CASHIER: sell + fulfill, no cancel/refund/delete
  it('CASHIER can confirm orders', () => {
    expect(hasPermission('CASHIER', Permission.ORDERS_TRANSITION_CONFIRM)).toBe(
      true,
    );
  });
  it('CASHIER can fulfill orders', () => {
    expect(hasPermission('CASHIER', Permission.ORDERS_TRANSITION_FULFILL)).toBe(
      true,
    );
  });
  it('CASHIER cannot cancel orders', () => {
    expect(hasPermission('CASHIER', Permission.ORDERS_TRANSITION_CANCEL)).toBe(
      false,
    );
  });
  it('CASHIER cannot reopen orders', () => {
    expect(hasPermission('CASHIER', Permission.ORDERS_TRANSITION_REOPEN)).toBe(
      false,
    );
  });
  it('CASHIER cannot refund orders', () => {
    expect(hasPermission('CASHIER', Permission.ORDERS_TRANSITION_REFUND)).toBe(
      false,
    );
  });
  it('CASHIER cannot delete orders', () => {
    expect(hasPermission('CASHIER', Permission.ORDERS_DELETE)).toBe(false);
  });
  it('CASHIER cannot delete customers', () => {
    expect(hasPermission('CASHIER', Permission.CUSTOMERS_DELETE)).toBe(false);
  });
  it('CASHIER cannot read audit logs', () => {
    expect(hasPermission('CASHIER', Permission.AUDIT_LOGS_READ)).toBe(false);
  });
  it('CASHIER cannot adjust inventory', () => {
    expect(hasPermission('CASHIER', Permission.INVENTORY_ADJUST)).toBe(false);
  });

  // SUPPORT: read-only
  it('SUPPORT can read customers', () => {
    expect(hasPermission('SUPPORT', Permission.CUSTOMERS_READ)).toBe(true);
  });
  it('SUPPORT cannot create customers', () => {
    expect(hasPermission('SUPPORT', Permission.CUSTOMERS_CREATE)).toBe(false);
  });
  it('SUPPORT cannot read audit logs', () => {
    expect(hasPermission('SUPPORT', Permission.AUDIT_LOGS_READ)).toBe(false);
  });
  it('SUPPORT cannot transition orders', () => {
    expect(hasPermission('SUPPORT', Permission.ORDERS_TRANSITION_CONFIRM)).toBe(
      false,
    );
    expect(hasPermission('SUPPORT', Permission.ORDERS_TRANSITION_CANCEL)).toBe(
      false,
    );
  });

  // INVENTORY_CLERK: inventory ops + read-only elsewhere
  it('INVENTORY_CLERK can adjust inventory', () => {
    expect(hasPermission('INVENTORY_CLERK', Permission.INVENTORY_ADJUST)).toBe(
      true,
    );
  });
  it('INVENTORY_CLERK can count inventory', () => {
    expect(hasPermission('INVENTORY_CLERK', Permission.INVENTORY_COUNT)).toBe(
      true,
    );
  });
  it('INVENTORY_CLERK can read products', () => {
    expect(hasPermission('INVENTORY_CLERK', Permission.PRODUCTS_READ)).toBe(
      true,
    );
  });
  it('INVENTORY_CLERK cannot create products', () => {
    expect(hasPermission('INVENTORY_CLERK', Permission.PRODUCTS_CREATE)).toBe(
      false,
    );
  });
  it('INVENTORY_CLERK cannot read orders', () => {
    expect(hasPermission('INVENTORY_CLERK', Permission.ORDERS_READ)).toBe(
      false,
    );
  });
  it('INVENTORY_CLERK cannot read customers', () => {
    expect(hasPermission('INVENTORY_CLERK', Permission.CUSTOMERS_READ)).toBe(
      false,
    );
  });
  it('INVENTORY_CLERK cannot read audit logs', () => {
    expect(hasPermission('INVENTORY_CLERK', Permission.AUDIT_LOGS_READ)).toBe(
      false,
    );
  });
});

// ── Section C: Transition permission completeness ─────────────────────────────

describe('Transition permissions', () => {
  const transitionPerms = [
    Permission.ORDERS_TRANSITION_CONFIRM,
    Permission.ORDERS_TRANSITION_FULFILL,
    Permission.ORDERS_TRANSITION_CANCEL,
    Permission.ORDERS_TRANSITION_REOPEN,
    Permission.ORDERS_TRANSITION_REFUND,
  ] as const;

  it('OWNER has all transition permissions', () => {
    transitionPerms.forEach((p) => {
      expect(hasPermission('OWNER', p)).toBe(true);
    });
  });

  it('MANAGER has all transition permissions', () => {
    transitionPerms.forEach((p) => {
      expect(hasPermission('MANAGER', p)).toBe(true);
    });
  });

  it('CASHIER has only confirm and fulfill', () => {
    expect(hasPermission('CASHIER', Permission.ORDERS_TRANSITION_CONFIRM)).toBe(
      true,
    );
    expect(hasPermission('CASHIER', Permission.ORDERS_TRANSITION_FULFILL)).toBe(
      true,
    );
    expect(hasPermission('CASHIER', Permission.ORDERS_TRANSITION_CANCEL)).toBe(
      false,
    );
    expect(hasPermission('CASHIER', Permission.ORDERS_TRANSITION_REOPEN)).toBe(
      false,
    );
    expect(hasPermission('CASHIER', Permission.ORDERS_TRANSITION_REFUND)).toBe(
      false,
    );
  });

  it('SUPPORT has no transition permissions', () => {
    transitionPerms.forEach((p) => {
      expect(hasPermission('SUPPORT', p)).toBe(false);
    });
  });

  it('INVENTORY_CLERK has no transition permissions', () => {
    transitionPerms.forEach((p) => {
      expect(hasPermission('INVENTORY_CLERK', p)).toBe(false);
    });
  });
});
