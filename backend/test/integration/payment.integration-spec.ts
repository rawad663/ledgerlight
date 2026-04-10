/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { INestApplication } from '@nestjs/common';
import { PrismaClient, Role } from '@prisma/generated/client';
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  RefundStatus,
} from '@prisma/generated/enums';
import request from 'supertest';
import { createAuthenticatedMember } from './utils/auth';
import { createLocation, createOrder, createProduct } from './utils/factories';
import {
  createTestContext,
  destroyTestContext,
  resetTestDatabase,
} from './utils/test-context';

describe('Payment integration', () => {
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

  it('marks confirmed orders as cash paid and then allows fulfilment', async () => {
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
      priceCents: 1950,
    });
    const order = await createOrder(prisma, {
      organizationId: auth.organization.id,
      locationId: location.id,
      status: OrderStatus.CONFIRMED,
      placedAt: new Date('2026-01-01T00:00:00.000Z'),
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

    const getPaymentResponse = await request(app.getHttpServer())
      .get(`/payments/${order.id}`)
      .set(auth.headers)
      .expect(200);

    expect(getPaymentResponse.body).toMatchObject({
      orderId: order.id,
      paymentStatus: PaymentStatus.UNPAID,
      refundStatus: RefundStatus.NONE,
      financialStatus: 'UNPAID',
    });

    const cashResponse = await request(app.getHttpServer())
      .post(`/payments/${order.id}/cash`)
      .set(auth.headers)
      .expect(201);

    expect(cashResponse.body).toMatchObject({
      orderId: order.id,
      method: PaymentMethod.CASH,
      paymentStatus: PaymentStatus.PAID,
      refundStatus: RefundStatus.NONE,
      financialStatus: 'PAID',
    });

    const fulfillResponse = await request(app.getHttpServer())
      .post(`/orders/${order.id}/transition-status`)
      .set(auth.headers)
      .send({ toStatus: OrderStatus.FULFILLED })
      .expect(201);

    expect(fulfillResponse.body).toMatchObject({
      status: OrderStatus.FULFILLED,
      payment: {
        paymentStatus: PaymentStatus.PAID,
        financialStatus: 'PAID',
      },
    });
  });

  it('refunds paid confirmed cash orders and cancels the order', async () => {
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
      priceCents: 1950,
    });
    const order = await createOrder(prisma, {
      organizationId: auth.organization.id,
      locationId: location.id,
      status: OrderStatus.CONFIRMED,
      placedAt: new Date('2026-01-01T00:00:00.000Z'),
      items: [
        {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          qty: 1,
          unitPriceCents: product.priceCents,
        },
      ],
      payment: {
        method: PaymentMethod.CASH,
        paymentStatus: PaymentStatus.PAID,
        refundStatus: RefundStatus.NONE,
        paidAt: new Date('2026-01-01T00:10:00.000Z'),
      },
    });

    const refundResponse = await request(app.getHttpServer())
      .post(`/payments/${order.id}/refund`)
      .set(auth.headers)
      .send({ refundReason: 'Customer requested cancellation' })
      .expect(201);

    expect(refundResponse.body).toMatchObject({
      orderId: order.id,
      refundStatus: RefundStatus.REFUNDED,
      financialStatus: 'REFUNDED',
      refundReason: 'Customer requested cancellation',
    });

    const refreshedOrder = await prisma.order.findUnique({
      where: {
        id_organizationId: {
          id: order.id,
          organizationId: auth.organization.id,
        },
      },
    });
    expect(refreshedOrder?.status).toBe(OrderStatus.CANCELLED);
  });

  it('keeps fulfilled orders fulfilled after a successful cash refund', async () => {
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
      priceCents: 1950,
    });
    const order = await createOrder(prisma, {
      organizationId: auth.organization.id,
      locationId: location.id,
      status: OrderStatus.FULFILLED,
      placedAt: new Date('2026-01-01T00:00:00.000Z'),
      items: [
        {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          qty: 1,
          unitPriceCents: product.priceCents,
        },
      ],
      payment: {
        method: PaymentMethod.CASH,
        paymentStatus: PaymentStatus.PAID,
        refundStatus: RefundStatus.NONE,
        paidAt: new Date('2026-01-01T00:10:00.000Z'),
      },
    });

    const refundResponse = await request(app.getHttpServer())
      .post(`/payments/${order.id}/refund`)
      .set(auth.headers)
      .send({ refundReason: 'Item returned after fulfilment' })
      .expect(201);

    expect(refundResponse.body).toMatchObject({
      refundStatus: RefundStatus.REFUNDED,
      financialStatus: 'REFUNDED',
    });

    const refreshedOrder = await prisma.order.findUnique({
      where: {
        id_organizationId: {
          id: order.id,
          organizationId: auth.organization.id,
        },
      },
    });
    expect(refreshedOrder?.status).toBe(OrderStatus.FULFILLED);
  });
});
