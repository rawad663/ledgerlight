import { PrismaService } from '@src/infra/prisma/prisma.service';
import { OrderService } from './order.service';
import { createPrismaMock } from '@src/test-utils/prisma.mock';
import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  OrderStatus,
  PaymentStatus,
  RefundStatus,
} from '@prisma/generated/enums';
import { PaymentService } from '@src/domain/payment/payment.service';

describe('OrderService', () => {
  let service: OrderService;
  let prisma: jest.Mocked<PrismaService>;
  let tx: jest.Mocked<PrismaService>;
  let paymentService: {
    createPaymentForConfirmedOrderTx: jest.Mock;
    ensureLegacyPaymentForOrderTx: jest.Mock;
    getPaymentByIdTx: jest.Mock;
    cancelActiveCardAttemptTx: jest.Mock;
    deletePaymentForReopenTx: jest.Mock;
  };

  beforeEach(async () => {
    tx = createPrismaMock();
    prisma = createPrismaMock(tx);
    paymentService = {
      createPaymentForConfirmedOrderTx: jest.fn(),
      ensureLegacyPaymentForOrderTx: jest.fn(),
      getPaymentByIdTx: jest.fn(),
      cancelActiveCardAttemptTx: jest.fn(),
      deletePaymentForReopenTx: jest.fn(),
    };
    tx.order.findFirst = tx.order.findUnique as any;
    prisma.order.findFirst = prisma.order.findUnique as any;

    const module = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: PrismaService, useValue: prisma },
        { provide: PaymentService, useValue: paymentService },
      ],
    }).compile();

    service = module.get(OrderService);
  });

  // ── Shared fixtures ──────────────────────────────────────────────────

  const orgId = 'org-1';
  const orderId = 'ord-1';
  const scopedOrg = {
    membershipId: 'mem-1',
    organizationId: orgId,
    role: 'MANAGER',
    hasAllLocations: false,
    allowedLocationIds: ['loc-1', 'loc-2'],
  } as any;
  const product = {
    id: 'p1',
    name: 'Widget',
    sku: 'WDG-01',
    priceCents: 1000,
  };

  // ── createOrder ──────────────────────────────────────────────────────

  describe('createOrder', () => {
    const validInput = {
      customerId: 'cust-1',
      locationId: 'loc-1',
      orderItems: [
        { productId: 'p1', qty: 3, discountCents: 200, taxCents: 100 },
      ],
    };

    function stubValidRefs() {
      (tx.customer.findFirst as jest.Mock).mockResolvedValue({
        id: 'cust-1',
      });
      (tx.location.findFirst as jest.Mock).mockResolvedValue({ id: 'loc-1' });
      (tx.product.findMany as jest.Mock).mockResolvedValue([product]);
    }

    it('throws when orderItems is empty', async () => {
      await expect(
        service.createOrder(orgId, { orderItems: [] } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when orderItems is undefined', async () => {
      await expect(service.createOrder(orgId, {} as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws for invalid customer', async () => {
      (tx.customer.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.createOrder(orgId, validInput as any),
      ).rejects.toThrow('Invalid customer for organization');
    });

    it('throws for invalid location', async () => {
      (tx.customer.findFirst as jest.Mock).mockResolvedValue({
        id: 'cust-1',
      });
      (tx.location.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.createOrder(orgId, validInput as any),
      ).rejects.toThrow('Invalid location for organization');
    });

    it('throws when a product is not found or inactive', async () => {
      (tx.customer.findFirst as jest.Mock).mockResolvedValue({
        id: 'cust-1',
      });
      (tx.location.findFirst as jest.Mock).mockResolvedValue({ id: 'loc-1' });
      (tx.product.findMany as jest.Mock).mockResolvedValue([]); // no match

      await expect(
        service.createOrder(orgId, validInput as any),
      ).rejects.toThrow('One or more products are invalid or inactive');
    });

    it('throws when qty is 0', async () => {
      stubValidRefs();

      await expect(
        service.createOrder(orgId, {
          ...validInput,
          orderItems: [{ productId: 'p1', qty: 0 }],
        } as any),
      ).rejects.toThrow('Item qty must be > 0');
    });

    it('throws when discount or tax is negative', async () => {
      stubValidRefs();

      await expect(
        service.createOrder(orgId, {
          ...validInput,
          orderItems: [{ productId: 'p1', qty: 1, discountCents: -1 }],
        } as any),
      ).rejects.toThrow('Cents values must be non-negative');
    });

    it('throws when discount exceeds line subtotal', async () => {
      stubValidRefs();

      await expect(
        service.createOrder(orgId, {
          ...validInput,
          orderItems: [{ productId: 'p1', qty: 1, discountCents: 9999 }],
        } as any),
      ).rejects.toThrow('Discount cannot exceed line subtotal');
    });

    it('creates order with correct totals for small carts (<= 20 items)', async () => {
      stubValidRefs();

      // qty=3 * 1000 = 3000 subtotal; -200 discount +100 tax = 2900 total
      const expectedTotals = {
        subtotalCents: 3000,
        taxCents: 100,
        discountCents: 200,
        totalCents: 2900,
      };

      const created = { id: orderId, ...expectedTotals, items: [] };
      (tx.order.create as jest.Mock).mockResolvedValue(created);

      const result = await service.createOrder(orgId, validInput as any);

      expect(tx.order.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ...expectedTotals,
          organizationId: orgId,
          status: OrderStatus.PENDING,
          items: { create: expect.any(Array) },
        }),
        include: { items: true },
      });
      expect(result).toEqual({ ...created, payment: null });
    });

    it('skips customer/location validation when not provided', async () => {
      (tx.product.findMany as jest.Mock).mockResolvedValue([product]);
      (tx.order.create as jest.Mock).mockResolvedValue({ id: orderId });

      await service.createOrder(orgId, {
        orderItems: [{ productId: 'p1', qty: 1 }],
      } as any);

      expect(tx.customer.findFirst).not.toHaveBeenCalled();
      expect(tx.location.findFirst).not.toHaveBeenCalled();
    });

    it('deduplicates product IDs when querying', async () => {
      (tx.product.findMany as jest.Mock).mockResolvedValue([product]);
      (tx.order.create as jest.Mock).mockResolvedValue({ id: orderId });

      await service.createOrder(orgId, {
        orderItems: [
          { productId: 'p1', qty: 1 },
          { productId: 'p1', qty: 2 },
        ],
      } as any);

      expect(tx.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: { in: ['p1'] } }),
        }),
      );
    });

    it('uses createManyAndReturn for large carts (> 20 items)', async () => {
      const items = Array.from({ length: 21 }, (_, i) => ({
        productId: `p${i}`,
        qty: 1,
      }));
      const products = items.map((_, i) => ({
        id: `p${i}`,
        name: `P${i}`,
        sku: `S${i}`,
        priceCents: 100,
      }));

      (tx.product.findMany as jest.Mock).mockResolvedValue(products);
      (tx.order.create as jest.Mock).mockResolvedValue({ id: orderId });
      (tx.orderItem.createManyAndReturn as jest.Mock).mockResolvedValue([]);

      await service.createOrder(orgId, { orderItems: items } as any);

      expect(tx.orderItem.createManyAndReturn).toHaveBeenCalled();
      // Nested create should NOT have been used
      expect(tx.order.create).toHaveBeenCalledWith({
        data: expect.not.objectContaining({ items: expect.anything() }),
      });
    });

    it('defaults discount and tax to 0 when omitted', async () => {
      (tx.product.findMany as jest.Mock).mockResolvedValue([product]);
      (tx.order.create as jest.Mock).mockResolvedValue({ id: orderId });

      await service.createOrder(orgId, {
        orderItems: [{ productId: 'p1', qty: 2 }],
      } as any);

      // subtotal = 2*1000 = 2000, total = 2000-0+0 = 2000
      expect(tx.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subtotalCents: 2000,
            discountCents: 0,
            taxCents: 0,
            totalCents: 2000,
          }),
        }),
      );
    });
  });

  // ── transitionStatus ─────────────────────────────────────────────────

  describe('transitionStatus', () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');

    function makeOrder(
      status: OrderStatus,
      payment?: Record<string, any> | null,
      overrides: Record<string, any> = {},
    ) {
      return {
        id: orderId,
        organizationId: orgId,
        status,
        totalCents: 1950,
        createdAt,
        placedAt: status === OrderStatus.PENDING ? null : createdAt,
        cancelledAt: status === OrderStatus.CANCELLED ? createdAt : null,
        payment: payment ?? null,
        ...overrides,
      };
    }

    it('throws NotFoundException when order does not exist', async () => {
      (tx.order.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.transitionStatus(orgId, orderId, {
          toStatus: OrderStatus.CONFIRMED,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for invalid transition', async () => {
      (tx.order.findUnique as jest.Mock).mockResolvedValue(
        makeOrder(OrderStatus.FULFILLED),
      );

      await expect(
        service.transitionStatus(orgId, orderId, {
          toStatus: OrderStatus.PENDING,
        }),
      ).rejects.toThrow('Cannot transition from FULFILLED to PENDING');
    });

    it('confirms a pending order and creates its payment in the same transaction', async () => {
      (tx.order.findUnique as jest.Mock)
        .mockResolvedValueOnce(makeOrder(OrderStatus.PENDING))
        .mockResolvedValueOnce(
          makeOrder(OrderStatus.CONFIRMED, {
            id: 'pay-1',
            paymentStatus: PaymentStatus.UNPAID,
            refundStatus: RefundStatus.NONE,
            amountCents: 1950,
            currencyCode: 'CAD',
          }),
        );
      (tx.order.update as jest.Mock).mockResolvedValue({});
      paymentService.createPaymentForConfirmedOrderTx.mockResolvedValue({
        id: 'pay-1',
      });

      const result = await service.transitionStatus(orgId, orderId, {
        toStatus: OrderStatus.CONFIRMED,
      });

      expect(tx.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: OrderStatus.CONFIRMED,
            placedAt: expect.any(Date),
            cancelledAt: null,
          }),
        }),
      );
      expect(
        paymentService.createPaymentForConfirmedOrderTx,
      ).toHaveBeenCalledWith(
        tx,
        {
          orderId,
          organizationId: orgId,
          amountCents: 1950,
          orderCreatedAt: createdAt,
        },
        {},
      );
      expect(result.payment).toMatchObject({
        paymentStatus: PaymentStatus.UNPAID,
        refundStatus: RefundStatus.NONE,
      });
    });

    it('sets cancelledAt when cancelling a pending order', async () => {
      (tx.order.findUnique as jest.Mock)
        .mockResolvedValueOnce(makeOrder(OrderStatus.PENDING))
        .mockResolvedValueOnce(makeOrder(OrderStatus.CANCELLED));
      (tx.order.update as jest.Mock).mockResolvedValue({});

      await service.transitionStatus(orgId, orderId, {
        toStatus: OrderStatus.CANCELLED,
      });

      expect(tx.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: OrderStatus.CANCELLED,
            cancelledAt: expect.any(Date),
          }),
        }),
      );
    });

    it('rejects fulfilment until the payment is paid', async () => {
      (tx.order.findUnique as jest.Mock).mockResolvedValueOnce(
        makeOrder(OrderStatus.CONFIRMED, { id: 'pay-1' }),
      );
      paymentService.getPaymentByIdTx.mockResolvedValue({
        id: 'pay-1',
        paymentStatus: PaymentStatus.UNPAID,
        refundStatus: RefundStatus.NONE,
      });

      await expect(
        service.transitionStatus(orgId, orderId, {
          toStatus: OrderStatus.FULFILLED,
        }),
      ).rejects.toThrow(
        'Confirmed orders can only be fulfilled after payment has been completed',
      );
      expect(tx.order.update).not.toHaveBeenCalled();
    });

    it('allows fulfilment when payment is paid and no refund is active', async () => {
      (tx.order.findUnique as jest.Mock)
        .mockResolvedValueOnce(
          makeOrder(OrderStatus.CONFIRMED, { id: 'pay-1' }),
        )
        .mockResolvedValueOnce(
          makeOrder(OrderStatus.FULFILLED, {
            id: 'pay-1',
            paymentStatus: PaymentStatus.PAID,
            refundStatus: RefundStatus.NONE,
            amountCents: 1950,
            currencyCode: 'CAD',
          }),
        );
      paymentService.getPaymentByIdTx.mockResolvedValue({
        id: 'pay-1',
        paymentStatus: PaymentStatus.PAID,
        refundStatus: RefundStatus.NONE,
      });
      (tx.order.update as jest.Mock).mockResolvedValue({});

      const result = await service.transitionStatus(orgId, orderId, {
        toStatus: OrderStatus.FULFILLED,
      });

      expect(tx.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: OrderStatus.FULFILLED },
        }),
      );
      expect(result.status).toBe(OrderStatus.FULFILLED);
    });

    it('cancels an open card attempt before cancelling a confirmed order', async () => {
      (tx.order.findUnique as jest.Mock)
        .mockResolvedValueOnce(
          makeOrder(OrderStatus.CONFIRMED, { id: 'pay-1' }),
        )
        .mockResolvedValueOnce(
          makeOrder(OrderStatus.CANCELLED, {
            id: 'pay-1',
            paymentStatus: PaymentStatus.FAILED,
            refundStatus: RefundStatus.NONE,
            amountCents: 1950,
            currencyCode: 'CAD',
          }),
        );
      paymentService.getPaymentByIdTx.mockResolvedValue({
        id: 'pay-1',
        paymentStatus: PaymentStatus.PENDING,
        refundStatus: RefundStatus.NONE,
      });
      paymentService.cancelActiveCardAttemptTx.mockResolvedValue({});
      (tx.order.update as jest.Mock).mockResolvedValue({});

      await service.transitionStatus(orgId, orderId, {
        toStatus: OrderStatus.CANCELLED,
      });

      expect(paymentService.cancelActiveCardAttemptTx).toHaveBeenCalledWith(
        tx,
        'pay-1',
        {},
      );
    });

    it('rejects cancelling a paid order', async () => {
      (tx.order.findUnique as jest.Mock).mockResolvedValueOnce(
        makeOrder(OrderStatus.CONFIRMED, { id: 'pay-1' }),
      );
      paymentService.getPaymentByIdTx.mockResolvedValue({
        id: 'pay-1',
        paymentStatus: PaymentStatus.PAID,
        refundStatus: RefundStatus.NONE,
      });

      await expect(
        service.transitionStatus(orgId, orderId, {
          toStatus: OrderStatus.CANCELLED,
        }),
      ).rejects.toThrow('Paid orders must be refunded instead of cancelled');
    });

    it('deletes the unpaid payment when reopening a cancelled order', async () => {
      (tx.order.findUnique as jest.Mock)
        .mockResolvedValueOnce(
          makeOrder(OrderStatus.CANCELLED, { id: 'pay-1' }),
        )
        .mockResolvedValueOnce(makeOrder(OrderStatus.PENDING));
      paymentService.getPaymentByIdTx.mockResolvedValue({
        id: 'pay-1',
        paymentStatus: PaymentStatus.FAILED,
        refundStatus: RefundStatus.NONE,
      });
      paymentService.deletePaymentForReopenTx.mockResolvedValue(undefined);
      (tx.order.update as jest.Mock).mockResolvedValue({});

      await service.transitionStatus(orgId, orderId, {
        toStatus: OrderStatus.PENDING,
      });

      expect(paymentService.deletePaymentForReopenTx).toHaveBeenCalledWith(
        tx,
        'pay-1',
        {},
      );
      expect(tx.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: OrderStatus.PENDING,
            placedAt: null,
            cancelledAt: null,
          }),
        }),
      );
    });

    it('rejects reopening a paid or refunded order', async () => {
      (tx.order.findUnique as jest.Mock).mockResolvedValueOnce(
        makeOrder(OrderStatus.CANCELLED, { id: 'pay-1' }),
      );
      paymentService.getPaymentByIdTx.mockResolvedValue({
        id: 'pay-1',
        paymentStatus: PaymentStatus.PAID,
        refundStatus: RefundStatus.REFUNDED,
      });

      await expect(
        service.transitionStatus(orgId, orderId, {
          toStatus: OrderStatus.PENDING,
        }),
      ).rejects.toThrow('Paid or refunded orders cannot be reopened');
    });
  });

  // ── getOrders ────────────────────────────────────────────────────────

  describe('getOrders', () => {
    const locations = [{ id: 'loc-1', name: 'Downtown' }];

    beforeEach(() => {
      (prisma.location.findMany as jest.Mock).mockResolvedValue(locations);
    });

    it('passes org, status filter, and pagination to paginateMany', async () => {
      const items = [{ id: 'ord-1' }, { id: 'ord-2' }] as any[];
      (prisma.paginateMany as jest.Mock).mockResolvedValue({
        data: items,
        total: 5,
        nextCursor: 'ord-2',
      });

      const query = {
        withItems: true,
        status: OrderStatus.PENDING,
        limit: 2,
        sortBy: 'createdAt',
        sortOrder: 'asc' as const,
      };

      const result = await service.getOrders(orgId, query as any);

      expect(prisma.paginateMany).toHaveBeenCalledWith(
        prisma.order,
        {
          where: { organizationId: orgId, status: OrderStatus.PENDING },
          include: {
            customer: {
              select: {
                email: true,
                id: true,
                name: true,
              },
            },
            location: {
              select: {
                addressLine1: true,
                city: true,
                countryCode: true,
                id: true,
                name: true,
                postalCode: true,
                stateProvince: true,
              },
            },
            items: true,
            payment: true,
          },
        },
        expect.objectContaining({
          limit: 2,
          sortBy: 'createdAt',
          sortOrder: 'asc',
        }),
      );
      expect(result).toEqual({
        data: items.map((item) => ({ ...item, payment: null })),
        totalCount: 5,
        locations,
        nextCursor: 'ord-2',
      });
    });

    it('defaults orderBy to updatedAt desc when no sortBy given', async () => {
      (prisma.paginateMany as jest.Mock).mockResolvedValue({
        data: [],
        total: 0,
        nextCursor: undefined,
      });

      await service.getOrders(orgId, { withItems: false } as any);

      expect(prisma.paginateMany).toHaveBeenCalledWith(
        prisma.order,
        expect.anything(),
        expect.objectContaining({}),
      );
    });

    it('applies search filter on order ID, customer name, and email', async () => {
      (prisma.paginateMany as jest.Mock).mockResolvedValue({
        data: [],
        total: 0,
        nextCursor: undefined,
      });

      await service.getOrders(orgId, {
        withItems: false,
        search: 'emily',
        limit: 20,
      } as any);

      expect(prisma.paginateMany).toHaveBeenCalledWith(
        prisma.order,
        expect.objectContaining({
          where: {
            organizationId: orgId,
            OR: [
              { id: { contains: 'emily', mode: 'insensitive' } },
              {
                customer: {
                  name: { contains: 'emily', mode: 'insensitive' },
                },
              },
              {
                customer: {
                  email: { contains: 'emily', mode: 'insensitive' },
                },
              },
            ],
          },
        }),
        expect.anything(),
      );
    });

    it('applies locationId filter', async () => {
      (prisma.paginateMany as jest.Mock).mockResolvedValue({
        data: [],
        total: 0,
      });

      await service.getOrders(orgId, {
        withItems: false,
        locationId: 'loc-1',
        limit: 20,
      } as any);

      expect(prisma.paginateMany).toHaveBeenCalledWith(
        prisma.order,
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: orgId,
            locationId: 'loc-1',
          }),
        }),
        expect.anything(),
      );
    });

    it('returns locations in response', async () => {
      (prisma.paginateMany as jest.Mock).mockResolvedValue({
        data: [],
        total: 0,
      });

      const result = await service.getOrders(orgId, {
        withItems: false,
        limit: 20,
      } as any);

      expect(result.locations).toEqual(locations);
      expect(prisma.location.findMany).toHaveBeenCalledWith({
        where: { organizationId: orgId },
        orderBy: { name: 'asc' },
        select: {
          addressLine1: true,
          city: true,
          countryCode: true,
          id: true,
          name: true,
          postalCode: true,
          stateProvince: true,
        },
      });
    });

    it('uses id scope for the location list while keeping order filters on locationId for restricted memberships', async () => {
      (prisma.paginateMany as jest.Mock).mockResolvedValue({
        data: [],
        total: 0,
        nextCursor: undefined,
      });

      await service.getOrders(scopedOrg, {
        withItems: false,
        limit: 20,
      } as any);

      expect(prisma.paginateMany).toHaveBeenCalledWith(
        prisma.order,
        expect.objectContaining({
          where: {
            organizationId: orgId,
            locationId: { in: ['loc-1', 'loc-2'] },
          },
        }),
        expect.anything(),
      );
      expect(prisma.location.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: orgId,
          id: { in: ['loc-1', 'loc-2'] },
        },
        orderBy: { name: 'asc' },
        select: {
          addressLine1: true,
          city: true,
          countryCode: true,
          id: true,
          name: true,
          postalCode: true,
          stateProvince: true,
        },
      });
    });
  });

  // ── getOrderById ─────────────────────────────────────────────────────

  describe('getOrderById', () => {
    it('returns order when found for the org', async () => {
      const order = { id: orderId, organizationId: orgId };
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(order);

      const result = await service.getOrderById(orgId, orderId, {
        withItems: false,
      });

      expect(result).toEqual({ ...order, payment: null });
      expect(prisma.order.findUnique).toHaveBeenCalledWith({
        where: { id: orderId, organizationId: orgId },
        include: {
          items: false,
          customer: {
            select: {
              email: true,
              id: true,
              name: true,
            },
          },
          location: {
            select: {
              addressLine1: true,
              city: true,
              countryCode: true,
              id: true,
              name: true,
              postalCode: true,
              stateProvince: true,
            },
          },
          payment: true,
        },
      });
    });

    it('includes items when withItems is true', async () => {
      const order = { id: orderId, organizationId: orgId, items: [] };
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(order);

      await service.getOrderById(orgId, orderId, { withItems: true });

      expect(prisma.order.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            items: true,
            customer: {
              select: {
                email: true,
                id: true,
                name: true,
              },
            },
            location: {
              select: {
                addressLine1: true,
                city: true,
                countryCode: true,
                id: true,
                name: true,
                postalCode: true,
                stateProvince: true,
              },
            },
            payment: true,
          },
        }),
      );
    });

    it('throws NotFoundException when not found', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.getOrderById(orgId, orderId, { withItems: false }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── updateOrder ──────────────────────────────────────────────────────

  describe('updateOrder', () => {
    it('updates with valid customer and location', async () => {
      (prisma.customer.findFirst as jest.Mock).mockResolvedValue({
        id: 'cust-1',
      });
      (prisma.location.findFirst as jest.Mock).mockResolvedValue({
        id: 'loc-1',
      });
      const updated = { id: orderId };
      (prisma.order.update as jest.Mock).mockResolvedValue(updated);

      const result = await service.updateOrder(orgId, orderId, {
        customerId: 'cust-1',
        locationId: 'loc-1',
      } as any);

      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id_organizationId: { id: orderId, organizationId: orgId } },
        data: { customerId: 'cust-1', locationId: 'loc-1' },
        include: { payment: true },
      });
      expect(result).toEqual({ ...updated, payment: null });
    });

    it('throws for invalid customer', async () => {
      (prisma.customer.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.updateOrder(orgId, orderId, { customerId: 'bad' } as any),
      ).rejects.toThrow('Customer not found with given id');
    });

    it('throws for invalid location', async () => {
      (prisma.location.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.updateOrder(orgId, orderId, { locationId: 'bad' } as any),
      ).rejects.toThrow('Location not found with given id');
    });

    it('skips validation when customer/location not provided', async () => {
      (prisma.order.update as jest.Mock).mockResolvedValue({ id: orderId });

      await service.updateOrder(orgId, orderId, {} as any);

      expect(prisma.customer.findFirst).not.toHaveBeenCalled();
      expect(prisma.location.findFirst).not.toHaveBeenCalled();
    });

    it('scopes customer lookup by org', async () => {
      (prisma.customer.findFirst as jest.Mock).mockResolvedValue({
        id: 'cust-1',
      });
      (prisma.order.update as jest.Mock).mockResolvedValue({ id: orderId });

      await service.updateOrder(orgId, orderId, {
        customerId: 'cust-1',
      } as any);

      expect(prisma.customer.findFirst).toHaveBeenCalledWith({
        where: { id: 'cust-1', organizationId: orgId },
        select: { id: true },
      });
    });

    it('uses id scope when validating locations for restricted memberships', async () => {
      (prisma.location.findFirst as jest.Mock).mockResolvedValue({
        id: 'loc-1',
      });
      (prisma.order.findFirst as jest.Mock).mockResolvedValue({
        id: orderId,
        organizationId: orgId,
        locationId: 'loc-1',
      });
      (prisma.order.update as jest.Mock).mockResolvedValue({ id: orderId });

      await service.updateOrder(scopedOrg, orderId, {
        locationId: 'loc-1',
      } as any);

      expect(prisma.location.findFirst).toHaveBeenCalledWith({
        where: {
          organizationId: orgId,
          AND: [{ id: 'loc-1' }, { id: { in: ['loc-1', 'loc-2'] } }],
        },
        select: { id: true },
      });
    });
  });

  // ── deleteOrder ──────────────────────────────────────────────────────

  describe('deleteOrder', () => {
    it('deletes by compound key and returns deleted order', async () => {
      const deleted = { id: orderId, organizationId: orgId };
      (prisma.order.delete as jest.Mock).mockResolvedValue(deleted);

      const result = await service.deleteOrder(orgId, orderId);

      expect(prisma.order.delete).toHaveBeenCalledWith({
        where: { id_organizationId: { id: orderId, organizationId: orgId } },
        include: { payment: true },
      });
      expect(result).toEqual({ ...deleted, payment: null });
    });
  });

  // ── addOrderItem ─────────────────────────────────────────────────────

  describe('addOrderItem', () => {
    const itemInput = {
      productId: 'p1',
      qty: 2,
      discountCents: 50,
      taxCents: 30,
    };

    function stubOrderAndProduct() {
      (tx.order.findUnique as jest.Mock).mockResolvedValue({
        id: orderId,
        items: [],
      });
      (tx.product.findFirst as jest.Mock).mockResolvedValue(product);
    }

    it('adds item and increments order totals', async () => {
      stubOrderAndProduct();
      const updated = { id: orderId, items: [{ id: 'oi-1' }] };
      (tx.order.update as jest.Mock).mockResolvedValue(updated);

      const result = await service.addOrderItem(
        orgId,
        orderId,
        itemInput as any,
      );

      // lineSubtotal = 2*1000 = 2000, lineTotal = 2000 - 50 + 30 = 1980
      expect(tx.order.update).toHaveBeenCalledWith({
        where: { id_organizationId: { id: orderId, organizationId: orgId } },
        data: {
          items: {
            create: {
              productId: 'p1',
              productName: 'Widget',
              sku: 'WDG-01',
              qty: 2,
              unitPriceCents: 1000,
              lineSubtotalCents: 2000,
              discountCents: 50,
              taxCents: 30,
              lineTotalCents: 1980,
            },
          },
          subtotalCents: { increment: 2000 },
          discountCents: { increment: 50 },
          taxCents: { increment: 30 },
          totalCents: { increment: 1980 },
        },
        include: { items: true, payment: true },
      });
      expect(result).toEqual({ ...updated, payment: null });
    });

    it('throws when order not found or not pending', async () => {
      (tx.order.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.addOrderItem(orgId, orderId, itemInput as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws when product not found', async () => {
      (tx.order.findUnique as jest.Mock).mockResolvedValue({
        id: orderId,
        items: [],
      });
      (tx.product.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.addOrderItem(orgId, orderId, itemInput as any),
      ).rejects.toThrow('Invalid product');
    });

    it('throws when product already exists in order', async () => {
      (tx.order.findUnique as jest.Mock).mockResolvedValue({
        id: orderId,
        items: [{ id: 'oi-1', productId: 'p1' }],
      });
      (tx.product.findFirst as jest.Mock).mockResolvedValue(product);

      await expect(
        service.addOrderItem(orgId, orderId, itemInput as any),
      ).rejects.toThrow('Product already exist in order');
    });

    it('throws when qty is 0', async () => {
      stubOrderAndProduct();

      await expect(
        service.addOrderItem(orgId, orderId, {
          ...itemInput,
          qty: 0,
        } as any),
      ).rejects.toThrow('Item qty must be > 0');
    });

    it('throws when discount is negative', async () => {
      stubOrderAndProduct();

      await expect(
        service.addOrderItem(orgId, orderId, {
          ...itemInput,
          discountCents: -1,
        } as any),
      ).rejects.toThrow('Cents must be non-negative');
    });

    it('throws when discount exceeds line subtotal', async () => {
      stubOrderAndProduct();

      await expect(
        service.addOrderItem(orgId, orderId, {
          ...itemInput,
          qty: 1,
          discountCents: 5000,
        } as any),
      ).rejects.toThrow('Discount exceeds line subtotal');
    });

    it('sets sku to undefined when product sku is null', async () => {
      (tx.order.findUnique as jest.Mock).mockResolvedValue({
        id: orderId,
        items: [],
      });
      (tx.product.findFirst as jest.Mock).mockResolvedValue({
        ...product,
        sku: null,
      });
      (tx.order.update as jest.Mock).mockResolvedValue({ id: orderId });

      await service.addOrderItem(orgId, orderId, {
        productId: 'p1',
        qty: 1,
      } as any);

      expect(tx.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            items: {
              create: expect.objectContaining({ sku: undefined }),
            },
          }),
        }),
      );
    });

    it('scopes product lookup by org', async () => {
      (tx.order.findUnique as jest.Mock).mockResolvedValue({
        id: orderId,
        items: [],
      });
      (tx.product.findFirst as jest.Mock).mockResolvedValue(product);
      (tx.order.update as jest.Mock).mockResolvedValue({ id: orderId });

      await service.addOrderItem(orgId, orderId, itemInput as any);

      expect(tx.product.findFirst).toHaveBeenCalledWith({
        where: { id: 'p1', organizationId: orgId },
        select: { id: true, name: true, sku: true, priceCents: true },
      });
    });
  });

  // ── deleteOrderItem ──────────────────────────────────────────────────

  describe('deleteOrderItem', () => {
    const itemId = 'oi-1';
    const existingItem = {
      id: itemId,
      lineSubtotalCents: 2000,
      discountCents: 100,
      taxCents: 50,
      lineTotalCents: 1950,
    };

    it('deletes item and decrements order totals', async () => {
      (tx.orderItem.findFirst as jest.Mock).mockResolvedValue(existingItem);
      (tx.orderItem.count as jest.Mock).mockResolvedValue(2);
      const updated = { id: orderId, items: [] };
      (tx.order.update as jest.Mock).mockResolvedValue(updated);

      const result = await service.deleteOrderItem(orgId, orderId, itemId);

      expect(tx.order.update).toHaveBeenCalledWith({
        where: {
          id_organizationId: { id: orderId, organizationId: orgId },
        },
        data: {
          items: { delete: { id: itemId } },
          subtotalCents: { decrement: 2000 },
          discountCents: { decrement: 100 },
          taxCents: { decrement: 50 },
          totalCents: { decrement: 1950 },
        },
        include: { items: true, payment: true },
      });
      expect(result).toEqual({ ...updated, payment: null });
    });

    it('throws when item not found', async () => {
      (tx.orderItem.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.deleteOrderItem(orgId, orderId, itemId),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws when it is the last item in the order', async () => {
      (tx.orderItem.findFirst as jest.Mock).mockResolvedValue(existingItem);
      (tx.orderItem.count as jest.Mock).mockResolvedValue(1);

      await expect(
        service.deleteOrderItem(orgId, orderId, itemId),
      ).rejects.toThrow('Order must have at least one item');
    });

    it('scopes item lookup by org and orderId', async () => {
      (tx.orderItem.findFirst as jest.Mock).mockResolvedValue(existingItem);
      (tx.orderItem.count as jest.Mock).mockResolvedValue(2);
      (tx.order.update as jest.Mock).mockResolvedValue({ id: orderId });

      await service.deleteOrderItem(orgId, orderId, itemId);

      expect(tx.orderItem.findFirst).toHaveBeenCalledWith({
        where: { id: itemId, orderId, organizationId: orgId },
        select: {
          id: true,
          lineSubtotalCents: true,
          discountCents: true,
          taxCents: true,
          lineTotalCents: true,
        },
      });
    });
  });
});
