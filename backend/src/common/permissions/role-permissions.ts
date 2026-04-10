import { Role } from '@prisma/generated/enums';
import { Permission, WILDCARD_PERMISSION } from './permissions';

/**
 * Authoritative mapping of roles to their permitted actions.
 * Roles are for UX and defaults; permissions are for enforcement.
 *
 * To add a new permission: add it to permissions.ts, then grant it to the
 * appropriate roles here. Existing roles are unaffected until explicitly updated.
 */
export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  OWNER: [WILDCARD_PERMISSION],

  MANAGER: [
    // Customers
    Permission.CUSTOMERS_READ,
    Permission.CUSTOMERS_CREATE,
    Permission.CUSTOMERS_UPDATE,
    Permission.CUSTOMERS_DELETE,
    // Products
    Permission.PRODUCTS_READ,
    Permission.PRODUCTS_CREATE,
    Permission.PRODUCTS_UPDATE,
    Permission.PRODUCTS_ARCHIVE,
    // Orders
    Permission.ORDERS_READ,
    Permission.ORDERS_CREATE,
    Permission.ORDERS_UPDATE,
    Permission.ORDERS_DELETE,
    Permission.ORDERS_TRANSITION_CONFIRM,
    Permission.ORDERS_TRANSITION_FULFILL,
    Permission.ORDERS_TRANSITION_CANCEL,
    Permission.ORDERS_TRANSITION_REOPEN,
    // Payments
    Permission.PAYMENTS_READ,
    Permission.PAYMENTS_CREATE,
    Permission.PAYMENTS_REFUND,
    // Inventory
    Permission.INVENTORY_READ,
    Permission.INVENTORY_ADJUST,
    Permission.INVENTORY_COUNT,
    // Locations
    Permission.LOCATIONS_READ,
    Permission.LOCATIONS_CREATE,
    Permission.LOCATIONS_UPDATE,
    Permission.LOCATIONS_ARCHIVE,
    // Users & audit
    Permission.USERS_READ,
    Permission.USERS_INVITE,
    Permission.AUDIT_LOGS_READ,
    Permission.REPORTS_READ,
  ],

  CASHIER: [
    // Customers — can create and update, not delete
    Permission.CUSTOMERS_READ,
    Permission.CUSTOMERS_CREATE,
    Permission.CUSTOMERS_UPDATE,
    // Products — read only
    Permission.PRODUCTS_READ,
    // Orders — can sell and fulfill, not cancel/refund/reopen
    Permission.ORDERS_READ,
    Permission.ORDERS_CREATE,
    Permission.ORDERS_UPDATE,
    Permission.ORDERS_TRANSITION_CONFIRM,
    Permission.ORDERS_TRANSITION_FULFILL,
    // Payments
    Permission.PAYMENTS_READ,
    Permission.PAYMENTS_CREATE,
    // Inventory — read only
    Permission.INVENTORY_READ,
    // Locations — read only
    Permission.LOCATIONS_READ,
  ],

  SUPPORT: [
    // Read-only across all operational domains
    Permission.CUSTOMERS_READ,
    Permission.PRODUCTS_READ,
    Permission.ORDERS_READ,
    Permission.PAYMENTS_READ,
    Permission.INVENTORY_READ,
    Permission.LOCATIONS_READ,
  ],

  INVENTORY_CLERK: [
    // Products — read only
    Permission.PRODUCTS_READ,
    // Inventory — full operational access
    Permission.INVENTORY_READ,
    Permission.INVENTORY_ADJUST,
    Permission.INVENTORY_COUNT,
    // Locations — read only (needed to select location for adjustments)
    Permission.LOCATIONS_READ,
  ],
};
