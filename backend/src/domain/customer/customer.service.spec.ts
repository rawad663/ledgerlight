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

  describe('getCustomers', () => {
    it('returns paginated results with nextCursor when full page', async () => {
      const items = [
        { id: '1', createdAt: new Date() },
        { id: '2', createdAt: new Date() },
      ] as any[];
      prisma.paginateMany.mockResolvedValue(items);

      const res = await service.getCustomers({
        organizationId: 'org-1',
        query: {
          limit: 2,
          cursor: undefined,
          sortBy: undefined,
          sortOrder: undefined,
        } as any,
      });

      expect(prisma.paginateMany).toHaveBeenCalledWith(
        prisma.customer,
        { where: { organizationId: 'org-1' } },
        expect.objectContaining({ limit: 2 }),
      );
      expect(res).toEqual({ data: items, totalCount: 2, nextCursor: '2' });
    });

    it('omits nextCursor when last page', async () => {
      const items = [{ id: '1', createdAt: new Date() }] as any[];
      prisma.paginateMany.mockResolvedValue(items);

      const res = await service.getCustomers({
        organizationId: 'org-1',
        query: {
          limit: 2,
          cursor: '0',
          sortBy: 'createdAt',
          sortOrder: 'asc',
        } as any,
      });

      expect(prisma.paginateMany).toHaveBeenCalledWith(
        prisma.customer,
        { where: { organizationId: 'org-1' } },
        { limit: 2, cursor: '0', orderBy: { createdAt: 'asc' } },
      );
      expect(res).toEqual({
        data: items,
        totalCount: 1,
        nextCursor: undefined,
      });
    });
  });

  describe('getCustomerById', () => {
    it('returns the customer when found', async () => {
      (prisma.customer.findFirst as jest.Mock).mockResolvedValue({
        id: 'c1',
      } as any);
      const res = await service.getCustomerById({
        organizationId: 'org',
        customerId: 'c1',
      });
      expect(prisma.customer.findFirst).toHaveBeenCalledWith({
        where: { id: 'c1', organizationId: 'org' },
      });
      expect(res).toEqual({ id: 'c1' });
    });

    it('throws NotFoundException when missing', async () => {
      (prisma.customer.findFirst as jest.Mock).mockResolvedValue(null as any);
      await expect(
        service.getCustomerById({ organizationId: 'org', customerId: 'nope' }),
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
        organizationId: 'org-1',
        customerData: body,
      });

      expect(prisma.customer.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ...body,
          organizationId: 'org-1',
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
        organizationId: 'org-1',
        customerId: 'c1',
        customerData: { name: 'New' },
      });

      expect(prisma.customer.update).toHaveBeenCalledWith({
        where: { id: 'c1', organizationId: 'org-1' },
        data: { name: 'New' },
      });
      expect(res).toBe(updated);
    });
  });

  describe('deleteCustomer', () => {
    it('deletes with composite where', async () => {
      const deleted = { id: 'c1' } as any;
      (prisma.customer.delete as jest.Mock).mockResolvedValue(deleted);

      const res = await service.deleteCustomer({
        organizationId: 'org-1',
        customerId: 'c1',
      });

      expect(prisma.customer.delete).toHaveBeenCalledWith({
        where: { id: 'c1', organizationId: 'org-1' },
      });
      expect(res).toBe(deleted);
    });
  });
});
