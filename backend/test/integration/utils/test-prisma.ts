import { PrismaClient } from '@prisma/generated/client';
import { PrismaPg } from '@prisma/adapter-pg';

const TABLES = [
  '"AuditLog"',
  '"StripeWebhookReceipt"',
  '"PaymentAttempt"',
  '"Payment"',
  '"OrderItem"',
  '"Order"',
  '"InventoryAdjustment"',
  '"InventoryLevel"',
  '"MembershipLocation"',
  '"InviteToken"',
  '"Membership"',
  '"RefreshToken"',
  '"Location"',
  '"Product"',
  '"Customer"',
  '"User"',
  '"Organization"',
];

let prisma: PrismaClient | null = null;

export function getTestPrisma() {
  if (!prisma) {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });

    prisma = new PrismaClient({ adapter });
  }

  return prisma;
}

export async function connectTestPrisma() {
  await getTestPrisma().$connect();
  return getTestPrisma();
}

export async function disconnectTestPrisma() {
  if (!prisma) {
    return;
  }

  await prisma.$disconnect();
  prisma = null;
}

export async function resetTestDatabase() {
  const client = await connectTestPrisma();

  await client.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`,
  );
}
