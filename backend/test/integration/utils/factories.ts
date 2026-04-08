import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import {
  CustomerStatus,
  MembershipStatus,
  OrderStatus,
  PrismaClient,
  Role,
} from '@prisma/generated/client';
import { LocationStatus, LocationType } from '@prisma/generated/enums';

type CreateOrganizationInput = {
  id?: string;
  name?: string;
};

type CreateUserInput = {
  id?: string;
  email?: string;
  password?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  isActive?: boolean;
  lastLoginAt?: Date | null;
};

type CreateMembershipInput = {
  id?: string;
  organizationId: string;
  userId: string;
  role?: Role;
  status?: MembershipStatus;
  invitedAt?: Date | null;
  activatedAt?: Date | null;
  deactivatedAt?: Date | null;
  locationIds?: string[];
};

type CreateLocationInput = {
  id?: string;
  organizationId: string;
  name?: string;
  code?: string | null;
  type?: LocationType;
  status?: LocationStatus;
  addressLine1?: string;
  addressLine2?: string | null;
  city?: string;
  stateProvince?: string | null;
  postalCode?: string | null;
  countryCode?: string;
  notes?: string | null;
};

type CreateCustomerInput = {
  id?: string;
  organizationId: string;
  name?: string;
  email?: string;
  phone?: string | null;
  status?: CustomerStatus;
  internalNote?: string | null;
};

type CreateProductInput = {
  id?: string;
  organizationId: string;
  name?: string;
  category?: string | null;
  sku?: string;
  priceCents?: number;
  reorderThreshold?: number;
  active?: boolean;
};

type CreateInventoryLevelInput = {
  id?: string;
  productId: string;
  locationId: string;
  quantity?: number;
};

type CreateOrderInput = {
  id?: string;
  organizationId: string;
  customerId?: string | null;
  locationId?: string | null;
  status?: OrderStatus;
  subtotalCents?: number;
  taxCents?: number;
  discountCents?: number;
  totalCents?: number;
  placedAt?: Date | null;
  cancelledAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  items?: Array<{
    id?: string;
    productId: string;
    productName: string;
    sku?: string | null;
    qty: number;
    unitPriceCents: number;
    discountCents?: number;
    taxCents?: number;
  }>;
};

function uniqueValue(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

export async function createOrganization(
  prisma: PrismaClient,
  input: CreateOrganizationInput = {},
) {
  return prisma.organization.create({
    data: {
      id: input.id ?? randomUUID(),
      name: input.name ?? uniqueValue('Org'),
    },
  });
}

export async function createUser(
  prisma: PrismaClient,
  input: CreateUserInput = {},
) {
  const passwordHash =
    input.password === undefined
      ? await bcrypt.hash('Password123!', 10)
      : input.password === null
        ? null
        : await bcrypt.hash(input.password, 10);

  return prisma.user.create({
    data: {
      id: input.id ?? randomUUID(),
      email: input.email ?? `${uniqueValue('user')}@example.com`,
      passwordHash,
      firstName: input.firstName ?? 'Test',
      lastName: input.lastName ?? 'User',
      isActive: input.isActive ?? true,
      lastLoginAt: input.lastLoginAt,
    },
  });
}

export async function createMembership(
  prisma: PrismaClient,
  input: CreateMembershipInput,
) {
  const membership = await prisma.membership.create({
    data: {
      id: input.id ?? randomUUID(),
      organizationId: input.organizationId,
      userId: input.userId,
      role: input.role ?? Role.OWNER,
      status: input.status ?? MembershipStatus.ACTIVE,
      invitedAt:
        input.invitedAt ??
        ((input.status ?? MembershipStatus.ACTIVE) === MembershipStatus.INVITED
          ? new Date()
          : null),
      activatedAt:
        input.activatedAt ??
        ((input.status ?? MembershipStatus.ACTIVE) === MembershipStatus.ACTIVE
          ? new Date()
          : null),
      deactivatedAt:
        input.deactivatedAt ??
        ((input.status ?? MembershipStatus.ACTIVE) ===
        MembershipStatus.DEACTIVATED
          ? new Date()
          : null),
    },
  });

  if (input.locationIds?.length) {
    await prisma.membershipLocation.createMany({
      data: input.locationIds.map((locationId) => ({
        membershipId: membership.id,
        locationId,
      })),
    });
  }

  return membership;
}

export async function createLocation(
  prisma: PrismaClient,
  input: CreateLocationInput,
) {
  return prisma.location.create({
    data: {
      id: input.id ?? randomUUID(),
      organizationId: input.organizationId,
      name: input.name ?? uniqueValue('Location'),
      code: input.code ?? uniqueValue('LOC').toUpperCase(),
      type: input.type ?? LocationType.STORE,
      status: input.status ?? LocationStatus.ACTIVE,
      addressLine1: input.addressLine1 ?? '123 Example Street',
      addressLine2: input.addressLine2 ?? null,
      city: input.city ?? 'Toronto',
      stateProvince: input.stateProvince ?? 'ON',
      postalCode: input.postalCode ?? 'M5V1E3',
      countryCode: input.countryCode ?? 'CA',
      notes: input.notes ?? null,
    },
  });
}

export async function createCustomer(
  prisma: PrismaClient,
  input: CreateCustomerInput,
) {
  return prisma.customer.create({
    data: {
      id: input.id ?? randomUUID(),
      organizationId: input.organizationId,
      name: input.name ?? uniqueValue('Customer'),
      email: input.email ?? `${uniqueValue('customer')}@example.com`,
      phone: input.phone ?? '555-000-0000',
      status: input.status ?? CustomerStatus.ACTIVE,
      internalNote: input.internalNote ?? null,
    },
  });
}

export async function createProduct(
  prisma: PrismaClient,
  input: CreateProductInput,
) {
  return prisma.product.create({
    data: {
      id: input.id ?? randomUUID(),
      organizationId: input.organizationId,
      name: input.name ?? uniqueValue('Product'),
      category: input.category ?? 'General',
      sku: input.sku ?? uniqueValue('SKU').toUpperCase(),
      priceCents: input.priceCents ?? 1200,
      reorderThreshold: input.reorderThreshold ?? 5,
      active: input.active ?? true,
    },
  });
}

export async function createInventoryLevel(
  prisma: PrismaClient,
  input: CreateInventoryLevelInput,
) {
  return prisma.inventoryLevel.create({
    data: {
      id: input.id ?? randomUUID(),
      productId: input.productId,
      locationId: input.locationId,
      quantity: input.quantity ?? 0,
    },
  });
}

export async function createOrder(
  prisma: PrismaClient,
  input: CreateOrderInput,
) {
  const items = input.items ?? [];
  const computedItems = items.map((item) => {
    const lineSubtotalCents = item.qty * item.unitPriceCents;
    const discountCents = item.discountCents ?? 0;
    const taxCents = item.taxCents ?? 0;

    return {
      id: item.id ?? randomUUID(),
      productId: item.productId,
      productName: item.productName,
      sku: item.sku ?? null,
      qty: item.qty,
      unitPriceCents: item.unitPriceCents,
      lineSubtotalCents,
      discountCents,
      taxCents,
      lineTotalCents: lineSubtotalCents - discountCents + taxCents,
    };
  });

  const subtotalCents =
    input.subtotalCents ??
    computedItems.reduce((sum, item) => sum + item.lineSubtotalCents, 0);
  const discountCents =
    input.discountCents ??
    computedItems.reduce((sum, item) => sum + item.discountCents, 0);
  const taxCents =
    input.taxCents ??
    computedItems.reduce((sum, item) => sum + item.taxCents, 0);
  const totalCents =
    input.totalCents ??
    computedItems.reduce((sum, item) => sum + item.lineTotalCents, 0);

  return prisma.order.create({
    data: {
      id: input.id ?? randomUUID(),
      organizationId: input.organizationId,
      customerId: input.customerId ?? null,
      locationId: input.locationId ?? null,
      status: input.status ?? OrderStatus.PENDING,
      subtotalCents,
      discountCents,
      taxCents,
      totalCents,
      placedAt: input.placedAt ?? null,
      cancelledAt: input.cancelledAt ?? null,
      ...(input.createdAt ? { createdAt: input.createdAt } : {}),
      ...(input.updatedAt ? { updatedAt: input.updatedAt } : {}),
      items: computedItems.length
        ? {
            create: computedItems,
          }
        : undefined,
    },
    include: {
      items: true,
    },
  });
}
