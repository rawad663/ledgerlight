/**
 * This script seeds the database with initial data for development/testing.
 * It is designed to be idempotent, so it can be safely re-run without creating duplicates.
 * Run with: npx tsx prisma/seed.ts inside your docker container or directly if you have the environment set up.
 */

import { PrismaClient, Role } from './generated/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

// Fixed IDs to make the script idempotent
const ORG_ID = '11111111-1111-1111-1111-111111111111';
const LOCATION_ID = '22222222-2222-2222-2222-222222222222';
const ADMIN_ID = '33333333-3333-3333-3333-333333333333';
const MANAGER_ID = '44444444-4444-4444-4444-444444444444';
const SUPPORT_ID = '55555555-5555-5555-5555-555555555555';

const PRODUCT_IDS = [
  '66666666-6666-6666-6666-666666666661',
  '66666666-6666-6666-6666-666666666662',
  '66666666-6666-6666-6666-666666666663',
];

const ROLES: Record<string, Role> = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  SUPPORT: 'SUPPORT',
};

async function main() {
  const passwordHash = await bcrypt.hash('Password123!', 10);

  // Organization
  const organization = await prisma.organization.upsert({
    where: { id: ORG_ID },
    update: { name: 'MOONWEAR Apparel Inc.' },
    create: { id: ORG_ID, name: 'MOONWEAR Apparel Inc.' },
  });

  // Users
  const adminInput = {
    email: 'admin@example.com',
    passwordHash,
    firstName: 'Admin',
    lastName: 'User',
    isActive: true,
  };
  const managerInput = {
    email: 'manager@example.com',
    passwordHash,
    firstName: 'Manager',
    lastName: 'User',
    isActive: true,
  };
  const supportInput = {
    email: 'support@example.com',
    passwordHash,
    firstName: 'Support',
    lastName: 'User',
    isActive: true,
  };

  const [admin, manager, support] = await Promise.all([
    prisma.user.upsert({
      where: { id: ADMIN_ID },
      update: { ...adminInput },
      create: { id: ADMIN_ID, ...adminInput },
    }),
    prisma.user.upsert({
      where: { id: MANAGER_ID },
      update: { ...managerInput },
      create: { id: MANAGER_ID, ...managerInput },
    }),
    prisma.user.upsert({
      where: { id: SUPPORT_ID },
      update: { ...supportInput },
      create: { id: SUPPORT_ID, ...supportInput },
    }),
  ]);

  // Memberships (unique on [organizationId, userId])
  await prisma.membership.createMany({
    data: [
      { organizationId: organization.id, userId: admin.id, role: ROLES.ADMIN },
      {
        organizationId: organization.id,
        userId: manager.id,
        role: ROLES.MANAGER,
      },
      {
        organizationId: organization.id,
        userId: support.id,
        role: ROLES.SUPPORT,
      },
    ],
    skipDuplicates: true,
  });

  // Location
  const location = await prisma.location.upsert({
    where: { id: LOCATION_ID },
    update: { name: 'Montreal QC' },
    create: {
      id: LOCATION_ID,
      organizationId: organization.id,
      name: 'Montreal QC',
    },
  });

  // Products
  const productInputs = [
    { name: 'Intentional Tee', sku: 'WID-A', priceCents: 1000, active: true },
    { name: 'Intentional Pants', sku: 'WID-B', priceCents: 1500, active: true },
    {
      name: 'Intentional Shorts',
      sku: 'WID-C',
      priceCents: 2500,
      active: true,
    },
  ];

  const products = await Promise.all([
    prisma.product.upsert({
      where: { id: PRODUCT_IDS[0] },
      update: { ...productInputs[0] },
      create: {
        id: PRODUCT_IDS[0],
        organizationId: organization.id,
        ...productInputs[0],
      },
    }),
    prisma.product.upsert({
      where: { id: PRODUCT_IDS[1] },
      update: { ...productInputs[1] },
      create: {
        id: PRODUCT_IDS[1],
        organizationId: organization.id,
        ...productInputs[1],
      },
    }),
    prisma.product.upsert({
      where: { id: PRODUCT_IDS[2] },
      update: { ...productInputs[2] },
      create: {
        id: PRODUCT_IDS[2],
        organizationId: organization.id,
        ...productInputs[2],
      },
    }),
  ]);

  // Inventory levels and adjustments (100 units each at Montreal, adjusted by admin)
  for (const p of products) {
    // Set level to 100 (idempotent)
    await prisma.inventoryLevel.upsert({
      where: {
        productId_locationId: { productId: p.id, locationId: location.id },
      },
      update: { quantity: 100 },
      create: { productId: p.id, locationId: location.id, quantity: 100 },
    });

    // Only create the seed adjustment once
    const existingAdj = await prisma.inventoryAdjustment.findFirst({
      where: {
        organizationId: organization.id,
        productId: p.id,
        locationId: location.id,
        actorUserId: admin.id,
        note: 'seed-initial-100',
      },
    });

    if (!existingAdj) {
      await prisma.inventoryAdjustment.create({
        data: {
          organizationId: organization.id,
          productId: p.id,
          locationId: location.id,
          delta: 100,
          reason: 'INITIAL_STOCK',
          note: 'seed-initial-100',
          actorUserId: admin.id,
        },
      });
    }
  }

  // Customers (100)
  // Use deterministic IDs so reruns skip duplicates via primary key
  const customerInputs = Array.from({ length: 100 }).map((_, i) => {
    const n = i + 1;
    const id = `cust-${String(n).padStart(3, '0')}`; // cust-001, cust-002, ..., cust-100
    return {
      id,
      organizationId: organization.id,
      name: `Customer ${n}`,
      email: `customer${n}@example.com`,
      phone: `555-555-5${String(n).padStart(3, '0')}`, // 555-555-5001, 555-555-5002, ..., 555-555-5100
      // status defaults to ACTIVE
    };
  });

  await prisma.customer.createMany({
    data: customerInputs,
    skipDuplicates: true,
  });

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
