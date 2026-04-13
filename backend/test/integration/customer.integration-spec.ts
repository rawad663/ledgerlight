/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
import { INestApplication } from '@nestjs/common';
import {
  CustomerStatus,
  MembershipStatus,
  PrismaClient,
  Role,
} from '@prisma/generated/client';
import request from 'supertest';
import { expectErrorResponse } from './utils/assertions';
import { buildAuthHeaders, createAuthenticatedMember } from './utils/auth';
import {
  createCustomer,
  createMembership,
  createOrganization,
  createUser,
} from './utils/factories';
import {
  createTestContext,
  destroyTestContext,
  resetTestDatabase,
} from './utils/test-context';

describe('Customer integration', () => {
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

  it('creates, lists, reads, updates, filters, and deletes customers through HTTP', async () => {
    const auth = await createAuthenticatedMember({
      prisma,
      app,
      role: Role.MANAGER,
    });

    const createResponse = await request(app.getHttpServer())
      .post('/customers')
      .set(auth.headers)
      .send({
        name: 'Alice Example',
        email: 'alice@example.com',
        phone: '555-123-4567',
        internalNote: 'vip',
      })
      .expect(201);

    expect(createResponse.body).toMatchObject({
      organizationId: auth.organization.id,
      name: 'Alice Example',
      email: 'alice@example.com',
      status: CustomerStatus.ACTIVE,
    });

    const customerId = createResponse.body.id as string;

    await createCustomer(prisma, {
      organizationId: auth.organization.id,
      name: 'Bob Searchable',
      email: 'bob@example.com',
      status: CustomerStatus.BLOCKED,
    });

    const searchResponse = await request(app.getHttpServer())
      .get('/customers')
      .query({
        search: 'Alice',
        status: CustomerStatus.ACTIVE,
      })
      .set(auth.headers)
      .expect(200);

    expect(searchResponse.body.totalCount).toBe(1);
    expect(searchResponse.body.data[0].id).toBe(customerId);

    const detailResponse = await request(app.getHttpServer())
      .get(`/customers/${customerId}`)
      .set(auth.headers)
      .expect(200);

    expect(detailResponse.body).toMatchObject({
      id: customerId,
      email: 'alice@example.com',
      ordersCount: 0,
      lifetimeSpendCents: 0,
    });

    const updateResponse = await request(app.getHttpServer())
      .patch(`/customers/${customerId}`)
      .set(auth.headers)
      .send({
        status: CustomerStatus.BLOCKED,
        internalNote: 'watch list',
      })
      .expect(200);

    expect(updateResponse.body).toMatchObject({
      id: customerId,
      status: CustomerStatus.BLOCKED,
      internalNote: 'watch list',
    });

    await request(app.getHttpServer())
      .delete(`/customers/${customerId}`)
      .set(auth.headers)
      .expect(200);

    const deletedCustomer = await prisma.customer.findUnique({
      where: { id: customerId },
    });
    expect(deletedCustomer).toBeNull();
  });

  it('enforces org isolation for customer reads', async () => {
    const ownerOne = await createAuthenticatedMember({
      prisma,
      app,
      role: Role.OWNER,
    });
    const ownerTwo = await createAuthenticatedMember({
      prisma,
      app,
      role: Role.OWNER,
    });
    const customer = await createCustomer(prisma, {
      organizationId: ownerOne.organization.id,
      name: 'Hidden Customer',
      email: 'hidden@example.com',
    });

    const response = await request(app.getHttpServer())
      .get(`/customers/${customer.id}`)
      .set(ownerTwo.headers)
      .expect(404);

    expectErrorResponse(response.body, {
      statusCode: 404,
      path: `/customers/:id`,
      message: 'Customer not found',
      resourceId: customer.id,
    });
  });

  it('denies customer writes for roles without permission', async () => {
    const organization = await createOrganization(prisma);
    const supportUser = await createUser(prisma, {
      email: 'support@example.com',
      password: 'Password123!',
    });
    await createMembership(prisma, {
      organizationId: organization.id,
      userId: supportUser.id,
      role: Role.SUPPORT,
      status: MembershipStatus.ACTIVE,
    });
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: supportUser.email,
        password: 'Password123!',
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/customers')
      .set(
        buildAuthHeaders(
          loginResponse.body.accessToken as string,
          organization.id,
        ),
      )
      .send({
        name: 'Forbidden Customer',
        email: 'forbidden@example.com',
      })
      .expect(403);

    expectErrorResponse(response.body, {
      statusCode: 403,
      path: '/customers',
      message: 'Insufficient permissions',
    });
  });
});
