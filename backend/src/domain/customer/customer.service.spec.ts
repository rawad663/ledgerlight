import { Test } from '@nestjs/testing';
import { CustomerService } from './customer.service';
import { PrismaService } from '@src/infra/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { createPrismaMock } from '@src/test-utils/prisma.mock';

describe('CustomerService', () => {
  let service: CustomerService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    prisma = createPrismaMock();

    const module = await Test.createTestingModule({
      providers: [
        CustomerService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(CustomerService);
  });

  const orgId = 'org-1';

  describe('getCustomers', () => {
    it('returns paginated results with enriched aggregate fields', async () => {
      const items = [
        { id: 'c1', createdAt: new Date() },
        { id: 'c2', createdAt: new Date() },
      ] as any[];
      prisma.paginateMany.mockResolvedValue({
        data: items,
        total: 10,
        nextCursor: 'c2',
      });

      (prisma.order.groupBy as jest.Mock).mockResolvedValue([
        {
          customerId: 'c1',
          _sum: { totalCents: 5000 },
          _count: 2,
          _max: { createdAt: new Date('2026-03-01') },
        },
      ]);

      const res = await service.getCustomers(orgId, { limit: 2 } as any);

      expect(prisma.paginateMany).toHaveBeenCalledWith(
        prisma.customer,
        { where: { organizationId: orgId } },
        expect.objectContaining({ limit: 2 }),
      );
      expect(prisma.order.groupBy).toHaveBeenCalledWith({
        by: ['customerId'],
        where: { customerId: { in: ['c1', 'c2'] }, organizationId: orgId },
        _sum: { totalCents: true },
        _count: true,
        _max: { createdAt: true },
      });

      // c1 has orders
      expect(res.data[0]).toMatchObject({
        lifetimeSpendCents: 5000,
        ordersCount: 2,
        avgOrderValueCents: 2500,
      });
      expect(res.data[0].lastOrderDate).toEqual(new Date('2026-03-01'));

      // c2 has no orders — defaults
      expect(res.data[1]).toMatchObject({
        lifetimeSpendCents: 0,
        ordersCount: 0,
        avgOrderValueCents: 0,
        lastOrderDate: null,
      });

      expect(res.nextCursor).toBe('c2');
      expect(res.totalCount).toBe(10);
    });

    it('omits nextCursor when last page', async () => {
      const items = [{ id: '1', createdAt: new Date() }] as any[];
      prisma.paginateMany.mockResolvedValue({
        data: items,
        total: 10,
        nextCursor: undefined,
      });
      (prisma.order.groupBy as jest.Mock).mockResolvedValue([]);

      const res = await service.getCustomers(orgId, {
        limit: 2,
        cursor: '0',
        sortBy: 'createdAt',
        sortOrder: 'asc',
      } as any);

      expect(prisma.paginateMany).toHaveBeenCalledWith(
        prisma.customer,
        { where: { organizationId: orgId } },
        { limit: 2, cursor: '0', sortBy: 'createdAt', sortOrder: 'asc' },
      );
      expect(res.nextCursor).toBeUndefined();
    });

    it('applies search filter on name, email, and phone', async () => {
      prisma.paginateMany.mockResolvedValue({
        data: [],
        total: 0,
        nextCursor: undefined,
      });
      (prisma.order.groupBy as jest.Mock).mockResolvedValue([]);

      await service.getCustomers(orgId, {
        search: 'emily',
        limit: 20,
      } as any);

      expect(prisma.paginateMany).toHaveBeenCalledWith(
        prisma.customer,
        {
          where: {
            organizationId: orgId,
            OR: [
              { name: { contains: 'emily', mode: 'insensitive' } },
              { email: { contains: 'emily', mode: 'insensitive' } },
              { phone: { contains: 'emily', mode: 'insensitive' } },
            ],
          },
        },
        expect.anything(),
      );
    });

    it('skips groupBy when no customers returned', async () => {
      prisma.paginateMany.mockResolvedValue({
        data: [],
        total: 0,
        nextCursor: undefined,
      });

      const res = await service.getCustomers(orgId, { limit: 20 } as any);

      expect(prisma.order.groupBy).not.toHaveBeenCalled();
      expect(res.data).toEqual([]);
    });
  });

  describe('getCustomerById', () => {
    it('returns customer with stats and recent orders', async () => {
      const customer = {
        id: 'c1',
        organizationId: orgId,
        name: 'Jane',
        email: 'jane@doe.com',
      };
      (prisma.customer.findFirst as jest.Mock).mockResolvedValue(
        customer as any,
      );
      (prisma.order.aggregate as jest.Mock).mockResolvedValue({
        _sum: { totalCents: 10000 },
        _count: 4,
        _max: { createdAt: new Date('2026-03-20') },
      });
      const recentOrders = [
        {
          id: 'o1',
          totalCents: 3000,
          status: 'PENDING',
          createdAt: new Date(),
        },
        {
          id: 'o2',
          totalCents: 2500,
          status: 'CONFIRMED',
          createdAt: new Date(),
        },
      ];
      (prisma.order.findMany as jest.Mock).mockResolvedValue(recentOrders);

      const res = await service.getCustomerById({
        organizationId: orgId,
        customerId: 'c1',
      });

      expect(prisma.customer.findFirst).toHaveBeenCalledWith({
        where: { id: 'c1', organizationId: orgId },
      });
      expect(prisma.order.aggregate).toHaveBeenCalledWith({
        where: { customerId: 'c1', organizationId: orgId },
        _sum: { totalCents: true },
        _count: true,
        _max: { createdAt: true },
      });
      expect(prisma.order.findMany).toHaveBeenCalledWith({
        where: { customerId: 'c1', organizationId: orgId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, totalCents: true, status: true, createdAt: true },
      });

      expect(res).toMatchObject({
        ...customer,
        lifetimeSpendCents: 10000,
        ordersCount: 4,
        avgOrderValueCents: 2500,
        recentOrders,
      });
      expect(res.lastOrderDate).toEqual(new Date('2026-03-20'));
    });

    it('returns zero stats for customer with no orders', async () => {
      (prisma.customer.findFirst as jest.Mock).mockResolvedValue({
        id: 'c1',
        organizationId: orgId,
      } as any);
      (prisma.order.aggregate as jest.Mock).mockResolvedValue({
        _sum: { totalCents: null },
        _count: 0,
        _max: { createdAt: null },
      });
      (prisma.order.findMany as jest.Mock).mockResolvedValue([]);

      const res = await service.getCustomerById({
        organizationId: orgId,
        customerId: 'c1',
      });

      expect(res.lifetimeSpendCents).toBe(0);
      expect(res.ordersCount).toBe(0);
      expect(res.avgOrderValueCents).toBe(0);
      expect(res.lastOrderDate).toBeNull();
      expect(res.recentOrders).toEqual([]);
    });

    it('throws NotFoundException when missing', async () => {
      (prisma.customer.findFirst as jest.Mock).mockResolvedValue(null as any);
      await expect(
        service.getCustomerById({ organizationId: orgId, customerId: 'nope' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('createCustomer', () => {
    it('creates with ACTIVE status and organizationId', async () => {
      const body = {
        name: 'Jane',
        email: 'jane@doe.com',
        phone: null,
        internalNote: null,
      } as any;
      const created = { id: 'c1', status: 'ACTIVE', ...body };
      (prisma.customer.create as jest.Mock).mockResolvedValue(created);

      const res = await service.createCustomer({
        organizationId: orgId,
        customerData: body,
      });

      expect(prisma.customer.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ...body,
          organizationId: orgId,
          status: 'ACTIVE',
        }),
      });
      expect(res).toBe(created);
    });
  });

  describe('updateCustomer', () => {
    it('updates with composite where and partial data', async () => {
      const updated = { id: 'c1', name: 'New' } as any;
      (prisma.customer.update as jest.Mock).mockResolvedValue(updated);

      const res = await service.updateCustomer({
        organizationId: orgId,
        customerId: 'c1',
        customerData: { name: 'New' },
      });

      expect(prisma.customer.update).toHaveBeenCalledWith({
        where: { id: 'c1', organizationId: orgId },
        data: { name: 'New' },
      });
      expect(res).toBe(updated);
    });
  });

  describe('deleteCustomer', () => {
    it('hard-deletes by setting status to INACTIVE', async () => {
      const deleted = { id: 'c1' } as any;
      (prisma.customer.delete as jest.Mock).mockResolvedValue(deleted);

      const res = await service.deleteCustomer({
        organizationId: orgId,
        customerId: 'c1',
      });

      expect(prisma.customer.delete).toHaveBeenCalledWith({
        where: { id: 'c1', organizationId: orgId },
      });
      expect(res).toBe(deleted);
    });
  });
});
