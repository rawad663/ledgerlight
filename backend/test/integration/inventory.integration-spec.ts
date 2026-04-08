/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
import { INestApplication } from '@nestjs/common';
import {
  InventoryAjustmentReason,
  PrismaClient,
  Role,
} from '@prisma/generated/client';
import request from 'supertest';
import { expectErrorResponse } from './utils/assertions';
import { createAuthenticatedMember } from './utils/auth';
import {
  createInventoryLevel,
  createLocation,
  createOrganization,
  createProduct,
} from './utils/factories';
import {
  createTestContext,
  destroyTestContext,
  resetTestDatabase,
} from './utils/test-context';

describe('Inventory integration', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  beforeAll(async () => {
    ({ app, prisma } = await createTestContext());
  });

  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterAll(async () => {
    await destroyTestContext(app);
  });

  it('returns aggregated inventory, filters levels, and respects low stock queries', async () => {
    const auth = await createAuthenticatedMember({
      prisma,
      app,
      role: Role.INVENTORY_CLERK,
    });
    const locationOne = await createLocation(prisma, {
      organizationId: auth.organization.id,
      name: 'Store One',
      code: 'ONE',
    });
    const locationTwo = await createLocation(prisma, {
      organizationId: auth.organization.id,
      name: 'Store Two',
      code: 'TWO',
    });
    const lowStockProduct = await createProduct(prisma, {
      organizationId: auth.organization.id,
      name: 'Low Stock Tee',
      sku: 'LOW-001',
      reorderThreshold: 5,
    });
    const healthyProduct = await createProduct(prisma, {
      organizationId: auth.organization.id,
      name: 'Healthy Tee',
      sku: 'OK-001',
      reorderThreshold: 2,
    });

    await createInventoryLevel(prisma, {
      productId: lowStockProduct.id,
      locationId: locationOne.id,
      quantity: 2,
    });
    await createInventoryLevel(prisma, {
      productId: lowStockProduct.id,
      locationId: locationTwo.id,
      quantity: 1,
    });
    await createInventoryLevel(prisma, {
      productId: healthyProduct.id,
      locationId: locationOne.id,
      quantity: 8,
    });

    const aggregatedResponse = await request(app.getHttpServer())
      .get('/inventory')
      .query({ lowStockOnly: true })
      .set(auth.headers)
      .expect(200);

    expect(aggregatedResponse.body.totalCount).toBe(1);
    expect(aggregatedResponse.body.data[0]).toMatchObject({
      productId: lowStockProduct.id,
      totalQuantity: 3,
      isLowStock: true,
    });

    const levelsResponse = await request(app.getHttpServer())
      .get('/inventory/levels')
      .query({
        search: 'LOW',
        locationId: locationOne.id,
        lowStockOnly: true,
      })
      .set(auth.headers)
      .expect(200);

    expect(levelsResponse.body.totalCount).toBe(1);
    expect(levelsResponse.body.lowStockCount).toBe(1);
    expect(levelsResponse.body.data[0]).toMatchObject({
      product: {
        id: lowStockProduct.id,
      },
      location: {
        id: locationOne.id,
      },
      quantity: 2,
    });
  });

  it('creates adjustments, updates levels, and rejects adjustments below zero', async () => {
    const auth = await createAuthenticatedMember({
      prisma,
      app,
      role: Role.INVENTORY_CLERK,
    });
    const location = await createLocation(prisma, {
      organizationId: auth.organization.id,
      name: 'Warehouse',
      code: 'WH',
    });
    const product = await createProduct(prisma, {
      organizationId: auth.organization.id,
      name: 'Adjustment Product',
      sku: 'ADJ-001',
    });

    const createAdjustmentResponse = await request(app.getHttpServer())
      .post('/inventory/adjustments')
      .set(auth.headers)
      .send({
        productId: product.id,
        locationId: location.id,
        delta: 6,
        reason: InventoryAjustmentReason.RESTOCK,
        note: 'truck delivery',
      })
      .expect(201);

    expect(createAdjustmentResponse.body.inventoryLevel).toMatchObject({
      productId: product.id,
      locationId: location.id,
      quantity: 6,
    });
    expect(createAdjustmentResponse.body.adjustment).toMatchObject({
      organizationId: auth.organization.id,
      actorUserId: auth.user.id,
      delta: 6,
      reason: InventoryAjustmentReason.RESTOCK,
    });

    const failureResponse = await request(app.getHttpServer())
      .post('/inventory/adjustments')
      .set(auth.headers)
      .send({
        productId: product.id,
        locationId: location.id,
        delta: -7,
        reason: InventoryAjustmentReason.SHRINKAGE,
      })
      .expect(400);

    expectErrorResponse(failureResponse.body, {
      statusCode: 400,
      path: '/inventory/adjustments',
      message: 'Attempting to reduce product stock below zero',
    });
  });

  it('limits inventory reads and writes to the authenticated location scope', async () => {
    const organization = await createOrganization(prisma);
    const allowedLocation = await createLocation(prisma, {
      organizationId: organization.id,
      name: 'Allowed Inventory',
      code: 'ALW',
    });
    const deniedLocation = await createLocation(prisma, {
      organizationId: organization.id,
      name: 'Denied Inventory',
      code: 'DEN',
    });
    const product = await createProduct(prisma, {
      organizationId: organization.id,
      name: 'Scoped Item',
      sku: 'SCOPE-1',
      reorderThreshold: 5,
    });
    await createInventoryLevel(prisma, {
      productId: product.id,
      locationId: allowedLocation.id,
      quantity: 2,
    });
    await createInventoryLevel(prisma, {
      productId: product.id,
      locationId: deniedLocation.id,
      quantity: 20,
    });
    const auth = await createAuthenticatedMember({
      prisma,
      app,
      organizationId: organization.id,
      role: Role.INVENTORY_CLERK,
      locationIds: [allowedLocation.id],
    });

    const scopedReadResponse = await request(app.getHttpServer())
      .get('/inventory')
      .set(auth.headers)
      .expect(200);

    expect(scopedReadResponse.body.data[0]).toMatchObject({
      productId: product.id,
      totalQuantity: 2,
    });
    expect(scopedReadResponse.body.data[0].locations).toHaveLength(1);

    const scopedWriteResponse = await request(app.getHttpServer())
      .post('/inventory/adjustments')
      .set(auth.headers)
      .send({
        productId: product.id,
        locationId: deniedLocation.id,
        delta: 1,
        reason: InventoryAjustmentReason.MANUAL,
      })
      .expect(403);

    expectErrorResponse(scopedWriteResponse.body, {
      statusCode: 403,
      path: '/inventory/adjustments',
      message: 'You do not have access to the selected location',
    });
  });
});
