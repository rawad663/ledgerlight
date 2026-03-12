import { PrismaService } from '@src/infra/prisma/prisma.service';

// Partial mock of PrismaService tailored for unit tests
export const createPrismaMock = () => {
  const prisma = {
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
