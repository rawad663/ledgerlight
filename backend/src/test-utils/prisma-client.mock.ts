// Minimal mock for @prisma/generated/client used in unit tests
export class PrismaClient {}

export const Role = {
  OWNER: 'OWNER',
  MANAGER: 'MANAGER',
  CASHIER: 'CASHIER',
  SUPPORT: 'SUPPORT',
  INVENTORY_CLERK: 'INVENTORY_CLERK',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const CustomerStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  BLOCKED: 'BLOCKED',
} as const;

export type CustomerStatus =
  (typeof CustomerStatus)[keyof typeof CustomerStatus];

export const LocationType = {
  STORE: 'STORE',
  WAREHOUSE: 'WAREHOUSE',
  POP_UP: 'POP_UP',
  OTHER: 'OTHER',
} as const;

export type LocationType = (typeof LocationType)[keyof typeof LocationType];

export const LocationStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  ARCHIVED: 'ARCHIVED',
} as const;

export type LocationStatus =
  (typeof LocationStatus)[keyof typeof LocationStatus];
