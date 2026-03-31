# Plan: Permission-Based RBAC for POS Backend

## Context
The current system enforces authorization using three coarse roles (`ADMIN`, `MANAGER`, `SUPPORT`) checked directly against HTTP routes via `@Authorized('ADMIN', 'MANAGER')`. This model cannot express the real authorization boundaries a POS needs — e.g., a cashier who can sell but not cancel, or an inventory clerk who can adjust stock but not touch orders. This plan migrates to a permission-based RBAC model with business-capability permissions evaluated per organization membership.

---

## Architecture Change Summary

**Before:**
- `@OrgProtected()` at class level → JWT + OrgContext guards
- `@Authorized('ADMIN', 'MANAGER')` at method level → JWT + OrgContext + RolesGuard (checks `@Roles()` metadata)
- Roles: `ADMIN`, `MANAGER`, `SUPPORT`

**After:**
- `@OrgProtected()` at class level → JWT + OrgContext + **PermissionsGuard**
- `@RequirePermissions(Permission.X)` at method level → sets metadata only (no extra guard instantiation)
- Roles: `OWNER` (was ADMIN), `MANAGER`, `CASHIER` (new), `SUPPORT`, `INVENTORY_CLERK` (new)
- `PermissionsGuard` derives permissions from `ROLE_PERMISSIONS` map at runtime; OWNER gets wildcard `'*'`

---

## Permission & Role Matrix

### Permissions (by domain)

| Domain | Permissions |
|---|---|
| customers | `customers.read`, `.create`, `.update`, `.delete` |
| products | `products.read`, `.create`, `.update`, `.archive` |
| orders | `orders.read`, `.create`, `.update`, `.delete`, `orders.transition.confirm`, `orders.transition.fulfill`, `orders.transition.cancel`, `orders.transition.reopen`, `orders.transition.refund` |
| inventory | `inventory.read`, `.adjust`, `.count` |
| locations | `locations.read`, `.create`, `.update`, `.archive`, `.delete` |
| users | `users.read`, `users.manage` |
| roles | `roles.manage` |
| settings | `settings.manage` |
| audit logs | `audit_logs.read` |

### Role → Permission Mapping

| Permission | OWNER | MANAGER | CASHIER | SUPPORT | INVENTORY_CLERK |
|---|:---:|:---:|:---:|:---:|:---:|
| `customers.read` | ✓ | ✓ | ✓ | ✓ | — |
| `customers.create` | ✓ | ✓ | ✓ | — | — |
| `customers.update` | ✓ | ✓ | ✓ | — | — |
| `customers.delete` | ✓ | ✓ | — | — | — |
| `products.read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `products.create/update` | ✓ | ✓ | — | — | — |
| `products.archive` | ✓ | ✓ | — | — | — |
| `orders.read` | ✓ | ✓ | ✓ | ✓ | — |
| `orders.create` | ✓ | ✓ | ✓ | — | — |
| `orders.update` | ✓ | ✓ | ✓ | — | — |
| `orders.delete` | ✓ | ✓ | — | — | — |
| `orders.transition.confirm` | ✓ | ✓ | ✓ | — | — |
| `orders.transition.fulfill` | ✓ | ✓ | ✓ | — | — |
| `orders.transition.cancel` | ✓ | ✓ | — | — | — |
| `orders.transition.reopen` | ✓ | ✓ | — | — | — |
| `orders.transition.refund` | ✓ | ✓ | — | — | — |
| `inventory.read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `inventory.adjust` | ✓ | ✓ | — | — | ✓ |
| `inventory.count` | ✓ | ✓ | — | — | ✓ |
| `locations.read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `locations.create/update` | ✓ | ✓ | — | — | — |
| `locations.archive` | ✓ | ✓ | — | — | — |
| `users.read` | ✓ | ✓ | — | — | — |
| `audit_logs.read` | ✓ | ✓ | — | — | — |
| `users.manage`, `roles.manage`, `settings.manage` | ✓ | — | — | — | — |

> **`POST /orders/:id/transition-status` uses two-layer enforcement:**
>
> The service already enforces valid `ALLOWED_TRANSITIONS` per `toStatus`. The permission mapping mirrors the existing transition graph:
> - `PENDING → CONFIRMED`: `orders.transition.confirm`
> - `CONFIRMED → FULFILLED`: `orders.transition.fulfill`
> - `PENDING/CONFIRMED → CANCELLED`: `orders.transition.cancel`
> - `CANCELLED → PENDING`: `orders.transition.reopen`
> - `FULFILLED → REFUNDED`: `orders.transition.refund`
>
> **Layer 1 (route guard):** `@RequireAnyPermission(orders.transition.confirm, orders.transition.fulfill, orders.transition.cancel, orders.transition.reopen, orders.transition.refund)` — blocks SUPPORT and INVENTORY_CLERK entirely.
>
> **Layer 2 (controller, before service call):** Map `toStatus → requiredPermission`, call `hasPermission(org.role, requiredPermission)`, throw `ForbiddenException('Insufficient permissions')` if false. This is where CASHIER attempting `.cancel` or `.reopen` or `.refund` is blocked.
>
> `locations.delete`, `users.manage`, `roles.manage`, `settings.manage` are defined but have no current routes. They exist for forward compatibility.

---

## Route → Permission Declaration

| Route | Permission |
|---|---|
| `GET /customers`, `GET /customers/:id` | `customers.read` |
| `POST /customers` | `customers.create` |
| `PATCH /customers/:id` | `customers.update` |
| `DELETE /customers/:id` | `customers.delete` |
| `GET /products`, `GET /products/:id` | `products.read` |
| `POST /products` | `products.create` |
| `PATCH /products/:id` | `products.update` |
| `DELETE /products/:id` | `products.archive` |
| `GET /orders`, `GET /orders/:id` | `orders.read` |
| `POST /orders` | `orders.create` |
| `PATCH /orders/:id` | `orders.update` |
| `DELETE /orders/:id` | `orders.delete` |
| `POST /orders/:id/transition-status` | `@RequireAnyPermission` (see below) |
| `POST /orders/:id/items` | `orders.update` |
| `DELETE /orders/:id/items/:itemId` | `orders.update` |
| `GET /inventory`, `GET /inventory/levels` | `inventory.read` |
| `POST /inventory/adjustments` | `inventory.adjust` |
| `GET /locations`, `GET /locations/:id` | `locations.read` |
| `POST /locations` | `locations.create` |
| `PATCH /locations/:id` | `locations.update` |
| `DELETE /locations/:id` | `locations.archive` |
| `GET /audit-logs` | `audit_logs.read` |

---

## Implementation Steps

### Phase 1 — Permission constants (no DB, no breakage)

**1. Create `backend/src/common/permissions/permissions.ts`**
Define `Permission` as a `const` object with all permission strings + `WILDCARD_PERMISSION = '*'` and a union type.

**2. Create `backend/src/common/permissions/role-permissions.ts`**
Define `ROLE_PERMISSIONS: Record<string, string[]>` using the matrix above. OWNER maps to `['*']`. No Prisma imports — pure string map.

**3. Create `backend/src/common/permissions/index.ts`**
Barrel export.

---

### Phase 2 — New guard and decorator

**4. Create `backend/src/common/decorators/permissions.decorator.ts`**

Two decorators — AND semantics and OR semantics:
```typescript
export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export const PERMISSIONS_ANY_KEY = 'permissions_any';
export const RequireAnyPermission = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_ANY_KEY, permissions);
```
`@RequirePermissions` = all required permissions must be present (AND).
`@RequireAnyPermission` = at least one must be present (OR) — used for the transition endpoint.
Mirrors the pattern of `roles.decorator.ts`.

**5. Create `backend/src/common/guards/permissions.guard.ts`**

Key logic in `canActivate`:
1. Throw `ForbiddenException('Organization context is missing')` if `req.organization` absent
2. Throw if `req.user.memberships` absent
3. Find membership for the org; throw if not found
4. Read both metadata keys via Reflector:
   - `PERMISSIONS_KEY` → `required` (AND semantics)
   - `PERMISSIONS_ANY_KEY` → `requiredAny` (OR semantics)
5. If neither is declared (both empty/absent): throw `ForbiddenException('No permission declared for this route')` (default-deny)
6. Look up `ROLE_PERMISSIONS[membership.role]`
7. If `rolePerms.includes('*')` → return `true` (OWNER wildcard)
8. If `required` has entries: `required.every(p => rolePerms.includes(p))` → throw if false
9. If `requiredAny` has entries: `requiredAny.some(p => rolePerms.includes(p))` → throw if false

Also export a `hasPermission(role: string, permission: string): boolean` pure helper for controller-level fine-grained checks and testability in matrix tests.

**6. Update `backend/src/common/guards/index.ts`**
Add `export { PermissionsGuard } from './permissions.guard'`.

**7. Update `backend/src/common/decorators/auth.decorator.ts`**

Change `@OrgProtected()` to include `PermissionsGuard`:
```typescript
UseGuards(JwtAuthGuard, OrganizationContextGuard, PermissionsGuard)
```

Remove `@Authorized()` (no longer needed — permission metadata replaces role metadata). Remove imports of `RolesGuard`, `Roles`, and `Role` from this file.

---

### Phase 3 — Database migration

**8. Update `backend/prisma/schema.prisma`**
Change `enum Role` to: `OWNER`, `MANAGER`, `CASHIER`, `SUPPORT`, `INVENTORY_CLERK`

**9. Create Prisma migration**
Run `prisma migrate dev --name rename_admin_to_owner_add_new_roles --create-only`, then edit the generated SQL:

```sql
-- 1. Add new values (additive, safe)
ALTER TYPE "Role" ADD VALUE 'OWNER';
ALTER TYPE "Role" ADD VALUE 'CASHIER';
ALTER TYPE "Role" ADD VALUE 'INVENTORY_CLERK';

-- 2. Migrate existing ADMIN → OWNER
UPDATE "Membership" SET role = 'OWNER' WHERE role = 'ADMIN';

-- 3. Recreate enum without ADMIN
CREATE TYPE "Role_new" AS ENUM ('OWNER', 'MANAGER', 'CASHIER', 'SUPPORT', 'INVENTORY_CLERK');
ALTER TABLE "Membership"
  ALTER COLUMN "role" TYPE "Role_new"
  USING "role"::text::"Role_new";
DROP TYPE "Role";
ALTER TYPE "Role_new" RENAME TO "Role";
```

Then run `prisma migrate deploy` (or `dev`) and `prisma generate` to regenerate the client.

> **JWT backward-compatibility risk**: Tokens issued before migration carry `role: 'ADMIN'`. These will fail after migration since `ROLE_PERMISSIONS['ADMIN']` is undefined. Resolution: revoke all refresh tokens in the migration or add a 15-minute fallback alias `ROLE_PERMISSIONS['ADMIN'] = ROLE_PERMISSIONS['OWNER']` during the access-token TTL window.

**10. Update `backend/src/test-utils/prisma-client.mock.ts`**
Add Role mock export (consistent with other enums in this file):
```typescript
export const Role = {
  OWNER: 'OWNER', MANAGER: 'MANAGER',
  CASHIER: 'CASHIER', SUPPORT: 'SUPPORT',
  INVENTORY_CLERK: 'INVENTORY_CLERK',
} as const;
export type Role = (typeof Role)[keyof typeof Role];
```

---

### Phase 4 — Update all controllers

For each controller:
- Remove `@Authorized(...)` method decorators
- Add `@RequirePermissions(Permission.X)` per route per the table above
- GET routes (previously undecorated beyond class-level `@OrgProtected()`) must now also get `@RequirePermissions(Permission.X_READ)`

For `order.controller.ts` — `transitionStatus` requires special treatment:
1. Add `@RequireAnyPermission(Permission.ORDERS_TRANSITION_CONFIRM, Permission.ORDERS_TRANSITION_FULFILL, Permission.ORDERS_TRANSITION_CANCEL, Permission.ORDERS_TRANSITION_REOPEN, Permission.ORDERS_TRANSITION_REFUND)` as the route-level guard
2. Receive `org: CurrentOrg` (already present — it carries `.role` from `OrganizationContextGuard`)
3. Add a `TRANSITION_PERMISSION` lookup map in the controller method body
4. Call `hasPermission(org.role, TRANSITION_PERMISSION[data.toStatus])` — throw `ForbiddenException` if false — before delegating to the service

Files to update:
- `backend/src/domain/customer/customer.controller.ts`
- `backend/src/domain/product/product.controller.ts`
- `backend/src/domain/order/order.controller.ts`
- `backend/src/domain/inventory/inventory.controller.ts`
- `backend/src/domain/location/location.controller.ts`
- `backend/src/domain/audit-log/audit-log.controller.ts` ← currently has NO role restriction on `GET /audit-logs`; this route is being **restricted** to `audit_logs.read` (OWNER + MANAGER only)

---

### Phase 5 — Update tests

**11. Create `backend/src/common/guards/permissions.guard.spec.ts`**

Mirror `role.guard.spec.ts` structure. Use `makeCtx(req)` helper pattern. Test:
- Missing org context → ForbiddenException
- Missing memberships → ForbiddenException
- No membership for org → ForbiddenException
- No `@RequirePermissions()` metadata → ForbiddenException('No permission declared...')
- OWNER + any permission → passes (wildcard)
- MANAGER + `customers.create` → passes
- MANAGER + `roles.manage` → throws (not in MANAGER perms)
- CASHIER + `orders.create` → passes
- CASHIER + `orders.transition.confirm` → passes (OR check via `@RequireAnyPermission`)
- CASHIER + `orders.transition.cancel` → throws
- CASHIER + `orders.transition.refund` → throws
- SUPPORT + `customers.read` → passes
- SUPPORT + `customers.create` → throws
- INVENTORY_CLERK + `inventory.adjust` → passes
- INVENTORY_CLERK + `orders.read` → throws

**12. Create `backend/src/common/guards/permissions.matrix.spec.ts`**

Exhaustive role × permission test driven by the same `ROLE_PERMISSIONS` source:
```typescript
const ALL_ROLES = ['OWNER','MANAGER','CASHIER','SUPPORT','INVENTORY_CLERK'];
const ALL_PERMISSIONS = Object.values(Permission);

ALL_ROLES.forEach(role => {
  ALL_PERMISSIONS.forEach(permission => {
    const expected = hasPermission(role, permission);
    it(`${role} + ${permission} → ${expected ? 'ALLOW' : 'DENY'}`, () => {
      expect(hasPermission(role, permission)).toBe(expected);
    });
  });
});
```
This generates ~130 test cases automatically (5 roles × ~26 permissions).

Also include a section verifying every route in the declared route-permission table maps to a permission that the intended roles have.

**13. Update all 6 controller spec files**

In each controller spec file, replace:
```typescript
provide: RolesGuard,  →  provide: PermissionsGuard,
import { RolesGuard }  →  import { PermissionsGuard }
```

For `order.controller.spec.ts`, add tests for the `transitionStatus` in-handler permission check:
- CASHIER role + `toStatus: CONFIRMED` → delegates to service (allowed)
- CASHIER role + `toStatus: CANCELLED` → throws `ForbiddenException` (blocked before service call)
- MANAGER role + `toStatus: REFUNDED` → delegates to service (allowed)

These tests mock `PermissionsGuard.canActivate → true` (bypasses route-level guard) and pass `org.role` directly to verify the controller-level `hasPermission` call works correctly.

---

### Phase 6 — Cleanup

**14. Delete `backend/src/common/guards/role.guard.ts`**
**15. Delete `backend/src/common/decorators/roles.decorator.ts`**
**16. Remove `RolesGuard` export from `backend/src/common/guards/index.ts`**
**17. Delete `backend/src/common/guards/role.guard.spec.ts`** (replaced by `permissions.guard.spec.ts`)

---

## Critical Files

| File | Action |
|---|---|
| `backend/prisma/schema.prisma` | Update Role enum |
| `backend/src/common/permissions/permissions.ts` | **Create** — permission constants |
| `backend/src/common/permissions/role-permissions.ts` | **Create** — authoritative policy map |
| `backend/src/common/guards/permissions.guard.ts` | **Create** — new guard with wildcard + default-deny |
| `backend/src/common/decorators/permissions.decorator.ts` | **Create** — `@RequirePermissions()` |
| `backend/src/common/decorators/auth.decorator.ts` | Update `@OrgProtected()`, remove `@Authorized()` |
| `backend/src/common/guards/index.ts` | Add PermissionsGuard, remove RolesGuard |
| `backend/src/test-utils/prisma-client.mock.ts` | Add Role mock |
| All 6 domain controllers | Replace `@Authorized()` with `@RequirePermissions()` |
| All 6 controller spec files | Replace `RolesGuard` with `PermissionsGuard` in providers |
| `backend/src/common/guards/permissions.guard.spec.ts` | **Create** — guard unit tests |
| `backend/src/common/guards/permissions.matrix.spec.ts` | **Create** — exhaustive role×permission matrix |

---

## Verification

1. Run `npx prisma migrate dev` — confirms migration applies cleanly
2. Run `npx prisma generate` — confirms new Role enum generates correctly
3. Run `npm test` in `backend/` — all 27+ unit tests pass
4. Confirm `permissions.matrix.spec.ts` generates ~110 assertions and all pass
5. Manually test: CASHIER token + `DELETE /customers/:id` → 403; OWNER token + same → 200
6. Confirm `GET /audit-logs` with CASHIER token → 403 (was previously allowed)
