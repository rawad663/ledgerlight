export const Permission = {
  // Customers
  CUSTOMERS_READ: 'customers.read',
  CUSTOMERS_CREATE: 'customers.create',
  CUSTOMERS_UPDATE: 'customers.update',
  CUSTOMERS_DELETE: 'customers.delete',

  // Products
  PRODUCTS_READ: 'products.read',
  PRODUCTS_CREATE: 'products.create',
  PRODUCTS_UPDATE: 'products.update',
  PRODUCTS_ARCHIVE: 'products.archive',

  // Orders
  ORDERS_READ: 'orders.read',
  ORDERS_CREATE: 'orders.create',
  ORDERS_UPDATE: 'orders.update',
  ORDERS_DELETE: 'orders.delete',

  // Order status transitions (each maps to a specific business action)
  ORDERS_TRANSITION_CONFIRM: 'orders.transition.confirm', // PENDING → CONFIRMED
  ORDERS_TRANSITION_FULFILL: 'orders.transition.fulfill', // CONFIRMED → FULFILLED
  ORDERS_TRANSITION_CANCEL: 'orders.transition.cancel', // PENDING/CONFIRMED → CANCELLED
  ORDERS_TRANSITION_REOPEN: 'orders.transition.reopen', // CANCELLED → PENDING

  // Payments
  PAYMENTS_READ: 'payments.read',
  PAYMENTS_CREATE: 'payments.create',
  PAYMENTS_REFUND: 'payments.refund',

  // Inventory
  INVENTORY_READ: 'inventory.read',
  INVENTORY_ADJUST: 'inventory.adjust',
  INVENTORY_COUNT: 'inventory.count',

  // Locations
  LOCATIONS_READ: 'locations.read',
  LOCATIONS_CREATE: 'locations.create',
  LOCATIONS_UPDATE: 'locations.update',
  LOCATIONS_ARCHIVE: 'locations.archive',
  LOCATIONS_DELETE: 'locations.delete', // reserved for hard-delete (no route yet)

  // Users & roles (no routes yet — reserved for forward compatibility)
  USERS_READ: 'users.read',
  USERS_INVITE: 'users.invite',
  USERS_MANAGE: 'users.manage',
  ROLES_MANAGE: 'roles.manage',

  // Settings (no route yet)
  SETTINGS_MANAGE: 'settings.manage',

  // Audit logs
  AUDIT_LOGS_READ: 'audit_logs.read',

  // Reports
  REPORTS_READ: 'reports.read',
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

export const WILDCARD_PERMISSION = '*';
