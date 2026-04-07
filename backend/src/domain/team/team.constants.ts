import { Role } from '@prisma/generated/enums';
import {
  Permission,
  ROLE_PERMISSIONS,
  ROLE_TIER,
} from '@src/common/permissions';

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  OWNER:
    'Full access to all features including user management, settings, and role configuration.',
  MANAGER:
    'Full operational access across business domains with delegated lower-tier team management.',
  CASHIER:
    'Sales-focused access for orders, customer creation, and order fulfillment.',
  SUPPORT:
    'Read-only operational access for support and customer service workflows.',
  INVENTORY_CLERK:
    'Inventory-focused access for stock reads, counts, and adjustments.',
};

export const ROLE_SHORT_SUMMARIES: Record<Role, string> = {
  OWNER: 'Everything',
  MANAGER: 'Operations + delegated team management',
  CASHIER: 'Sales and fulfillment',
  SUPPORT: 'Read-only support access',
  INVENTORY_CLERK: 'Inventory operations',
};

export function getRolePermissions(role: Role): string[] {
  const permissions = ROLE_PERMISSIONS[role] ?? [];
  if (permissions.includes('*')) {
    return ['*'];
  }

  return [...permissions];
}

export function getRoleCatalog() {
  return Object.values(Role).map((role) => ({
    role,
    tier: ROLE_TIER[role],
    description: ROLE_DESCRIPTIONS[role],
    summary: ROLE_SHORT_SUMMARIES[role],
    permissions: getRolePermissions(role) as Permission[] | ['*'],
  }));
}
