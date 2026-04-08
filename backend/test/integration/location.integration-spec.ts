/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { INestApplication } from '@nestjs/common';
import { PrismaClient, Role } from '@prisma/generated/client';
import {
  LocationStatus,
  LocationType,
  OrderStatus,
} from '@prisma/generated/enums';
import request from 'supertest';
import { expectErrorResponse } from './utils/assertions';
import { createAuthenticatedMember } from './utils/auth';
import {
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

describe('Location integration', () => {
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

  it('creates, lists, reads, updates, and deletes locations through HTTP', async () => {
    const auth = await createAuthenticatedMember({
      prisma,
      app,
      role: Role.OWNER,
    });
    await createLocation(prisma, {
      organizationId: auth.organization.id,
      name: 'Baseline Store',
      code: 'BASE',
    });

    const createResponse = await request(app.getHttpServer())
      .post('/locations')
      .set(auth.headers)
      .send({
        name: 'Downtown',
        code: 'DT',
        type: LocationType.STORE,
        addressLine1: '10 King St',
        city: 'Toronto',
        stateProvince: 'ON',
        postalCode: 'M5H1A1',
        countryCode: 'CA',
      })
      .expect(201);

    const locationId = createResponse.body.id as string;
    expect(createResponse.body).toMatchObject({
      organizationId: auth.organization.id,
      name: 'Downtown',
      status: LocationStatus.ACTIVE,
    });

    const listResponse = await request(app.getHttpServer())
      .get('/locations')
      .query({ search: 'Down', type: LocationType.STORE })
      .set(auth.headers)
      .expect(200);

    expect(listResponse.body.totalCount).toBeGreaterThanOrEqual(1);
    expect(
      listResponse.body.data.some(
        (location: { id: string }) => location.id === locationId,
      ),
    ).toBe(true);

    await request(app.getHttpServer())
      .get(`/locations/${locationId}`)
      .set(auth.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body.id).toBe(locationId);
        expect(body.name).toBe('Downtown');
      });

    await request(app.getHttpServer())
      .patch(`/locations/${locationId}`)
      .set(auth.headers)
      .send({
        name: 'Downtown Updated',
        notes: 'refreshed notes',
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.name).toBe('Downtown Updated');
        expect(body.notes).toBe('refreshed notes');
      });

    await request(app.getHttpServer())
      .delete(`/locations/${locationId}`)
      .set(auth.headers)
      .expect(200);

    const deletedLocation = await prisma.location.findUnique({
      where: { id: locationId },
    });
    expect(deletedLocation).toBeNull();
  });

  it('blocks restricted members from creating or reading out-of-scope locations', async () => {
    const organization = await createOrganization(prisma);
    const allowedLocation = await createLocation(prisma, {
      organizationId: organization.id,
      name: 'Allowed',
      code: 'ALLOW',
    });
    const deniedLocation = await createLocation(prisma, {
      organizationId: organization.id,
      name: 'Denied',
      code: 'DENY',
    });
    const auth = await createAuthenticatedMember({
      prisma,
      app,
      organizationId: organization.id,
      role: Role.MANAGER,
      locationIds: [allowedLocation.id],
    });

    const createResponse = await request(app.getHttpServer())
      .post('/locations')
      .set(auth.headers)
      .send({
        name: 'Scoped Create',
        code: 'SCOPED',
        type: LocationType.STORE,
        addressLine1: '1 Test St',
        city: 'Toronto',
        countryCode: 'CA',
      })
      .expect(403);

    expectErrorResponse(createResponse.body, {
      statusCode: 403,
      path: '/locations',
      message: 'Only memberships with all-location access can create locations',
    });

    const detailResponse = await request(app.getHttpServer())
      .get(`/locations/${deniedLocation.id}`)
      .set(auth.headers)
      .expect(404);

    expectErrorResponse(detailResponse.body, {
      statusCode: 404,
      path: `/locations/${deniedLocation.id}`,
      message: 'Location not found',
    });
  });

  it('returns conflicts when deleting locations with inventory on hand or order history', async () => {
    const auth = await createAuthenticatedMember({
      prisma,
      app,
      role: Role.OWNER,
    });
    const baselineLocation = await createLocation(prisma, {
      organizationId: auth.organization.id,
      name: 'Baseline',
      code: 'BASE',
    });
    const inventoryLocation = await createLocation(prisma, {
      organizationId: auth.organization.id,
      name: 'Inventory Locked',
      code: 'INV',
    });
    const historyLocation = await createLocation(prisma, {
      organizationId: auth.organization.id,
      name: 'History Locked',
      code: 'HIS',
    });
    const product = await createProduct(prisma, {
      organizationId: auth.organization.id,
    });

    await createInventoryLevel(prisma, {
      productId: product.id,
      locationId: inventoryLocation.id,
      quantity: 2,
    });
    await createOrder(prisma, {
      organizationId: auth.organization.id,
      locationId: historyLocation.id,
      status: OrderStatus.CONFIRMED,
      placedAt: new Date(),
      items: [
        {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          qty: 1,
          unitPriceCents: product.priceCents,
        },
      ],
    });

    const inventoryConflict = await request(app.getHttpServer())
      .delete(`/locations/${inventoryLocation.id}`)
      .set(auth.headers)
      .expect(409);

    expectErrorResponse(inventoryConflict.body, {
      statusCode: 409,
      path: `/locations/${inventoryLocation.id}`,
      message: 'Cannot delete a location with inventory on hand',
    });

    const historyConflict = await request(app.getHttpServer())
      .delete(`/locations/${historyLocation.id}`)
      .set(auth.headers)
      .expect(409);

    expectErrorResponse(historyConflict.body, {
      statusCode: 409,
      path: `/locations/${historyLocation.id}`,
      message: 'Cannot delete a location with order history',
    });

    await request(app.getHttpServer())
      .get(`/locations/${baselineLocation.id}`)
      .set(auth.headers)
      .expect(200);
  });
});
