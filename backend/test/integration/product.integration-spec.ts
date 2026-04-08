/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { INestApplication } from '@nestjs/common';
import { PrismaClient, Role } from '@prisma/generated/client';
import request from 'supertest';
import { expectErrorResponse } from './utils/assertions';
import { createAuthenticatedMember } from './utils/auth';
import {
  createLocation,
  createOrganization,
  createProduct,
} from './utils/factories';
import {
  createTestContext,
  destroyTestContext,
  resetTestDatabase,
} from './utils/test-context';

describe('Product integration', () => {
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

  it('creates products with initial inventory, lists, reads, updates, and archives them', async () => {
    const auth = await createAuthenticatedMember({
      prisma,
      app,
      role: Role.MANAGER,
    });
    const location = await createLocation(prisma, {
      organizationId: auth.organization.id,
      name: 'Main Store',
      code: 'MAIN',
    });

    const createResponse = await request(app.getHttpServer())
      .post('/products')
      .set(auth.headers)
      .send({
        name: 'Everyday Tee',
        sku: 'TEE-001',
        category: 'Apparel',
        priceCents: 2500,
        reorderThreshold: 4,
        inventory: {
          locationId: location.id,
          quantity: 7,
          note: 'initial load',
        },
      })
      .expect(201);

    expect(createResponse.body.product).toMatchObject({
      organizationId: auth.organization.id,
      name: 'Everyday Tee',
      sku: 'TEE-001',
      active: true,
    });
    expect(createResponse.body.inventoryLevel).toMatchObject({
      locationId: location.id,
      quantity: 7,
    });
    expect(createResponse.body.adjustment).toMatchObject({
      organizationId: auth.organization.id,
      productId: createResponse.body.product.id,
      locationId: location.id,
      delta: 7,
      reason: 'INITIAL_STOCK',
    });

    const productId = createResponse.body.product.id as string;

    const listResponse = await request(app.getHttpServer())
      .get('/products')
      .query({ search: 'TEE', category: 'Apparel' })
      .set(auth.headers)
      .expect(200);

    expect(listResponse.body.totalCount).toBe(1);
    expect(listResponse.body.categories).toContain('Apparel');
    expect(listResponse.body.data[0].id).toBe(productId);

    await request(app.getHttpServer())
      .get(`/products/${productId}`)
      .set(auth.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body.id).toBe(productId);
        expect(body.name).toBe('Everyday Tee');
      });

    await request(app.getHttpServer())
      .patch(`/products/${productId}`)
      .set(auth.headers)
      .send({
        name: 'Everyday Tee Updated',
        priceCents: 3000,
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.name).toBe('Everyday Tee Updated');
        expect(body.priceCents).toBe(3000);
      });

    await request(app.getHttpServer())
      .delete(`/products/${productId}`)
      .set(auth.headers)
      .expect(200);

    const archivedProduct = await prisma.product.findUniqueOrThrow({
      where: { id: productId },
    });
    expect(archivedProduct.active).toBe(false);
  });

  it('returns a conflict response for duplicate org-scoped SKUs', async () => {
    const auth = await createAuthenticatedMember({
      prisma,
      app,
      role: Role.OWNER,
    });
    await createProduct(prisma, {
      organizationId: auth.organization.id,
      sku: 'DUPLICATE-SKU',
    });

    const response = await request(app.getHttpServer())
      .post('/products')
      .set(auth.headers)
      .send({
        name: 'Duplicate Product',
        sku: 'DUPLICATE-SKU',
        priceCents: 1000,
        reorderThreshold: 2,
      })
      .expect(409);

    expectErrorResponse(response.body, {
      statusCode: 409,
      path: '/products',
      message: 'Unique constraint violated',
    });
  });

  it('rejects initial inventory assignment for scoped memberships outside their locations', async () => {
    const organization = await createOrganization(prisma);
    const allowedLocation = await createLocation(prisma, {
      organizationId: organization.id,
      name: 'Allowed Store',
      code: 'ALLOW',
    });
    const deniedLocation = await createLocation(prisma, {
      organizationId: organization.id,
      name: 'Denied Store',
      code: 'DENY',
    });
    const auth = await createAuthenticatedMember({
      prisma,
      app,
      organizationId: organization.id,
      role: Role.MANAGER,
      locationIds: [allowedLocation.id],
    });

    const response = await request(app.getHttpServer())
      .post('/products')
      .set(auth.headers)
      .send({
        name: 'Scoped Product',
        sku: 'SCOPED-001',
        priceCents: 2200,
        reorderThreshold: 5,
        inventory: {
          locationId: deniedLocation.id,
          quantity: 3,
        },
      })
      .expect(403);

    expectErrorResponse(response.body, {
      statusCode: 403,
      path: '/products',
      message: 'You do not have access to the selected location',
    });
  });
});
