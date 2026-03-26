import { PrismaService } from '@src/infra/prisma/prisma.service';

// Partial mock of PrismaService tailored for unit tests
export const createPrismaMock = (tx?: Record<string, any>) => {
  const prisma: any = {
    // Query helpers
    paginateMany: jest.fn(),
    $queryRaw: jest.fn(),

    // Models used across services
    customer: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    product: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    inventoryLevel: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    inventoryAdjustment: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    order: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    orderItem: {
      findFirst: jest.fn(),
      count: jest.fn(),
      createManyAndReturn: jest.fn(),
    },
    location: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    auditLog: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    membership: {
      findMany: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  // Set up $transaction after prisma is defined so it can pass itself as the tx client
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  prisma.$transaction = jest.fn(async (arg: unknown) => {
    if (typeof arg === 'function') {
      return (arg as (client: any) => unknown)(tx ?? prisma);
    }
    if (Array.isArray(arg)) {
      return Promise.all(arg);
    }
    throw new Error('Unsupported $transaction mock usage');
  });

  return prisma as unknown as jest.Mocked<PrismaService>;
};
