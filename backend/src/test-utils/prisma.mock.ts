import { PrismaService } from '@src/infra/prisma/prisma.service';

// Partial mock of PrismaService tailored for unit tests
export const createPrismaMock = (tx?: Record<string, any>) => {
  const prisma = {
    // Query helpers
    paginateMany: jest.fn(),
    $queryRaw: jest.fn(),
    $transaction: jest.fn(async (arg) => {
      // interactive transaction: prisma.$transaction(async (tx) => { ... })
      if (typeof arg === 'function') {
        return (arg as (tx: any) => void)(tx);
      }

      // array transaction: prisma.$transaction([ ... ])
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }

      throw new Error('Unsupported $transaction mock usage');
    }),

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
  } as unknown as jest.Mocked<PrismaService>;

  return prisma;
};
