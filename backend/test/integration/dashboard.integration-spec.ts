/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { INestApplication } from '@nestjs/common';
import { PrismaClient, Role } from '@prisma/generated/client';
import { OrderStatus } from '@prisma/generated/enums';
import request from 'supertest';
import { DashboardSalesTimeline } from '@src/domain/dashboard/dashboard.dto';
import { createAuthenticatedMember } from './utils/auth';
import {
  createCustomer,
  createInventoryLevel,
  createLocation,
  createOrder,
  createOrganization,
  createProduct,
} from './utils/factories';
import {
  createTestContext,
  destroyTestContext,
  resetTestDatabase,
} from './utils/test-context';

describe('Dashboard integration', () => {
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

  it('returns dashboard summary values based on current org data', async () => {
    const auth = await createAuthenticatedMember({
      prisma,
      app,
      role: Role.MANAGER,
    });
    const location = await createLocation(prisma, {
      organizationId: auth.organization.id,
    });
    const customer = await createCustomer(prisma, {
      organizationId: auth.organization.id,
    });
    const product = await createProduct(prisma, {
      organizationId: auth.organization.id,
      reorderThreshold: 4,
    });

    await createInventoryLevel(prisma, {
      productId: product.id,
      locationId: location.id,
      quantity: 2,
    });
    await createOrder(prisma, {
      organizationId: auth.organization.id,
      customerId: customer.id,
      locationId: location.id,
      status: OrderStatus.CONFIRMED,
      placedAt: new Date(),
      items: [
        {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          qty: 2,
          unitPriceCents: 1500,
        },
      ],
    });

    const response = await request(app.getHttpServer())
      .get('/dashboard/summary')
      .set(auth.headers)
      .expect(200);

    expect(response.body).toMatchObject({
      todaysSalesCents: 3000,
      ordersTodayCount: 1,
      lowStockItemsCount: 1,
      activeCustomersCount: 1,
    });
  });

  it('returns bucketed sales overview for a requested timeline', async () => {
    const auth = await createAuthenticatedMember({
      prisma,
      app,
      role: Role.MANAGER,
    });
    const location = await createLocation(prisma, {
      organizationId: auth.organization.id,
    });
    const product = await createProduct(prisma, {
      organizationId: auth.organization.id,
    });
    const anchor = '2026-04-08T12:00:00.000Z';

    await createOrder(prisma, {
      organizationId: auth.organization.id,
      locationId: location.id,
      status: OrderStatus.CONFIRMED,
      placedAt: new Date('2026-04-07T15:00:00.000Z'),
      items: [
        {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          qty: 1,
          unitPriceCents: 1200,
        },
      ],
    });
    await createOrder(prisma, {
      organizationId: auth.organization.id,
      locationId: location.id,
      status: OrderStatus.FULFILLED,
      placedAt: new Date('2026-04-08T16:00:00.000Z'),
      items: [
        {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          qty: 2,
          unitPriceCents: 1200,
        },
      ],
    });

    const response = await request(app.getHttpServer())
      .get('/dashboard/sales-overview')
      .query({
        timeline: DashboardSalesTimeline.WEEK,
        anchor,
      })
      .set(auth.headers)
      .expect(200);

    expect(response.body.timeline).toBe(DashboardSalesTimeline.WEEK);
    expect(response.body.totalSalesCents).toBe(3600);
    expect(response.body.buckets).toHaveLength(7);
    expect(
      response.body.buckets.some(
        (bucket: { salesCents: number }) => bucket.salesCents === 1200,
      ),
    ).toBe(true);
    expect(
      response.body.buckets.some(
        (bucket: { salesCents: number }) => bucket.salesCents === 2400,
      ),
    ).toBe(true);
  });

  it('respects location scope for orders and inventory while keeping customer counts org-wide', async () => {
    const organization = await createOrganization(prisma);
    const allowedLocation = await createLocation(prisma, {
      organizationId: organization.id,
      name: 'Allowed Dashboard',
      code: 'ALW',
    });
    const deniedLocation = await createLocation(prisma, {
      organizationId: organization.id,
      name: 'Denied Dashboard',
      code: 'DEN',
    });
    const product = await createProduct(prisma, {
      organizationId: organization.id,
      reorderThreshold: 5,
    });
    await createCustomer(prisma, {
      organizationId: organization.id,
      email: 'customer1@example.com',
    });
    await createCustomer(prisma, {
      organizationId: organization.id,
      email: 'customer2@example.com',
    });
    await createInventoryLevel(prisma, {
      productId: product.id,
      locationId: allowedLocation.id,
      quantity: 1,
    });
    await createInventoryLevel(prisma, {
      productId: product.id,
      locationId: deniedLocation.id,
      quantity: 10,
    });
    await createOrder(prisma, {
      organizationId: organization.id,
      locationId: allowedLocation.id,
      status: OrderStatus.CONFIRMED,
      placedAt: new Date(),
      items: [
        {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          qty: 1,
          unitPriceCents: 1000,
        },
      ],
    });
    await createOrder(prisma, {
      organizationId: organization.id,
      locationId: deniedLocation.id,
      status: OrderStatus.CONFIRMED,
      placedAt: new Date(),
      items: [
        {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          qty: 4,
          unitPriceCents: 1000,
        },
      ],
    });
    const auth = await createAuthenticatedMember({
      prisma,
      app,
      organizationId: organization.id,
      role: Role.MANAGER,
      locationIds: [allowedLocation.id],
    });

    const response = await request(app.getHttpServer())
      .get('/dashboard/summary')
      .set(auth.headers)
      .expect(200);

    expect(response.body).toMatchObject({
      todaysSalesCents: 1000,
      ordersTodayCount: 1,
      lowStockItemsCount: 1,
      activeCustomersCount: 2,
    });
  });
});
