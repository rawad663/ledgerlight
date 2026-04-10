/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { INestApplication } from '@nestjs/common';
import { PrismaClient, Role } from '@prisma/generated/client';
import {
  OrderStatus,
  PaymentStatus,
  RefundStatus,
} from '@prisma/generated/enums';
import request from 'supertest';
import { expectErrorResponse } from './utils/assertions';
import { createAuthenticatedMember } from './utils/auth';
import {
  createCustomer,
  createLocation,
  createOrganization,
  createOrder,
  createProduct,
} from './utils/factories';
import {
  createTestContext,
  destroyTestContext,
  resetTestDatabase,
} from './utils/test-context';

describe('Order integration', () => {
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

  it('creates orders, lists/details them, updates metadata, manages items, and transitions status', async () => {
    const auth = await createAuthenticatedMember({
      prisma,
      app,
      role: Role.MANAGER,
    });
    const customer = await createCustomer(prisma, {
      organizationId: auth.organization.id,
    });
    const alternateCustomer = await createCustomer(prisma, {
      organizationId: auth.organization.id,
    });
    const location = await createLocation(prisma, {
      organizationId: auth.organization.id,
      name: 'Order Store',
      code: 'ORD',
    });
    const alternateLocation = await createLocation(prisma, {
      organizationId: auth.organization.id,
      name: 'Second Store',
      code: 'ORD2',
    });
    const productOne = await createProduct(prisma, {
      organizationId: auth.organization.id,
      name: 'Order Product One',
      sku: 'ORD-001',
      priceCents: 1000,
    });
    const productTwo = await createProduct(prisma, {
      organizationId: auth.organization.id,
      name: 'Order Product Two',
      sku: 'ORD-002',
      priceCents: 500,
    });

    const createResponse = await request(app.getHttpServer())
      .post('/orders')
      .set(auth.headers)
      .send({
        customerId: customer.id,
        locationId: location.id,
        orderItems: [
          {
            productId: productOne.id,
            qty: 2,
            discountCents: 100,
            taxCents: 50,
          },
        ],
      })
      .expect(201);

    const orderId = createResponse.body.id as string;
    expect(createResponse.body).toMatchObject({
      organizationId: auth.organization.id,
      customerId: customer.id,
      locationId: location.id,
      subtotalCents: 2000,
      discountCents: 100,
      taxCents: 50,
      totalCents: 1950,
      status: OrderStatus.PENDING,
    });
    expect(createResponse.body.items).toHaveLength(1);

    const listResponse = await request(app.getHttpServer())
      .get('/orders')
      .query({ withItems: true })
      .set(auth.headers)
      .expect(200);

    expect(listResponse.body.totalCount).toBe(1);
    expect(listResponse.body.data[0].id).toBe(orderId);
    expect(listResponse.body.data[0].items).toHaveLength(1);

    const detailResponse = await request(app.getHttpServer())
      .get(`/orders/${orderId}`)
      .query({ withItems: true })
      .set(auth.headers)
      .expect(200);

    expect(detailResponse.body).toMatchObject({
      id: orderId,
      customer: {
        id: customer.id,
      },
      location: {
        id: location.id,
      },
    });

    const updateResponse = await request(app.getHttpServer())
      .patch(`/orders/${orderId}`)
      .set(auth.headers)
      .send({
        customerId: alternateCustomer.id,
        locationId: alternateLocation.id,
      })
      .expect(200);

    expect(updateResponse.body).toMatchObject({
      customerId: alternateCustomer.id,
      locationId: alternateLocation.id,
    });

    const addItemResponse = await request(app.getHttpServer())
      .post(`/orders/${orderId}/items`)
      .set(auth.headers)
      .send({
        productId: productTwo.id,
        qty: 3,
        taxCents: 30,
      })
      .expect(201);

    expect(addItemResponse.body.items).toHaveLength(2);

    const itemToDelete = addItemResponse.body.items.find(
      (item: { productId: string }) => item.productId === productTwo.id,
    ) as { id: string };

    const deleteItemResponse = await request(app.getHttpServer())
      .delete(`/orders/${orderId}/items/${itemToDelete.id}`)
      .set(auth.headers)
      .expect(200);

    expect(deleteItemResponse.body.items).toHaveLength(1);

    const transitionResponse = await request(app.getHttpServer())
      .post(`/orders/${orderId}/transition-status`)
      .set(auth.headers)
      .send({
        toStatus: OrderStatus.CONFIRMED,
      })
      .expect(201);

    expect(transitionResponse.body).toMatchObject({
      status: OrderStatus.CONFIRMED,
      payment: {
        paymentStatus: PaymentStatus.UNPAID,
        refundStatus: RefundStatus.NONE,
        financialStatus: 'UNPAID',
      },
    });
    expect(transitionResponse.body.placedAt).toBeTruthy();

    const payment = await prisma.payment.findUnique({
      where: { orderId },
    });
    expect(payment).toMatchObject({
      orderId,
      organizationId: auth.organization.id,
      paymentStatus: PaymentStatus.UNPAID,
      refundStatus: RefundStatus.NONE,
      amountCents: 1950,
      currencyCode: 'CAD',
    });

    const invalidTransitionResponse = await request(app.getHttpServer())
      .post(`/orders/${orderId}/transition-status`)
      .set(auth.headers)
      .send({
        toStatus: OrderStatus.FULFILLED,
      })
      .expect(400);

    expectErrorResponse(invalidTransitionResponse.body, {
      statusCode: 400,
      path: `/orders/${orderId}/transition-status`,
      message:
        'Confirmed orders can only be fulfilled after payment has been completed',
    });
  });

  it('deletes orders through HTTP', async () => {
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
    const order = await createOrder(prisma, {
      organizationId: auth.organization.id,
      locationId: location.id,
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

    await request(app.getHttpServer())
      .delete(`/orders/${order.id}`)
      .set(auth.headers)
      .expect(200);

    const deletedOrder = await prisma.order.findUnique({
      where: {
        id_organizationId: {
          id: order.id,
          organizationId: auth.organization.id,
        },
      },
    });
    expect(deletedOrder).toBeNull();
  });

  it('prevents location-scoped members from accessing orders outside their allowed locations', async () => {
    const organization = await createOrganization(prisma);
    const allowedLocation = await createLocation(prisma, {
      organizationId: organization.id,
      name: 'Allowed Orders',
      code: 'ALW',
    });
    const deniedLocation = await createLocation(prisma, {
      organizationId: organization.id,
      name: 'Denied Orders',
      code: 'DEN',
    });
    const product = await createProduct(prisma, {
      organizationId: organization.id,
    });
    const deniedOrder = await createOrder(prisma, {
      organizationId: organization.id,
      locationId: deniedLocation.id,
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
    const auth = await createAuthenticatedMember({
      prisma,
      app,
      organizationId: organization.id,
      role: Role.MANAGER,
      locationIds: [allowedLocation.id],
    });

    const detailResponse = await request(app.getHttpServer())
      .get(`/orders/${deniedOrder.id}`)
      .query({ withItems: true })
      .set(auth.headers)
      .expect(404);

    expectErrorResponse(detailResponse.body, {
      statusCode: 404,
      path: `/orders/${deniedOrder.id}?withItems=true`,
      message: 'Order not found',
    });
  });
});
