import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/generated/client';
import { createIntegrationApp } from './create-integration-app';
import {
  connectTestPrisma,
  disconnectTestPrisma,
  getTestPrisma,
  resetTestDatabase,
} from './test-prisma';

export async function createTestContext(): Promise<{
  app: INestApplication;
  prisma: PrismaClient;
}> {
  await connectTestPrisma();

  return {
    app: await createIntegrationApp(),
    prisma: getTestPrisma(),
  };
}

export async function destroyTestContext(app?: INestApplication) {
  if (app) {
    await app.close();
  }

  await disconnectTestPrisma();
}

export { resetTestDatabase };
