import { Test } from '@nestjs/testing';
import { ProductService } from './product.service';
import { PrismaService } from '@src/infra/prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { NotFoundException } from '@nestjs/common';
import { createPrismaMock } from '@src/test-utils/prisma.mock';

describe('ProductService', () => {
  let service: ProductService;
  let prisma: jest.Mocked<PrismaService>;
  let inventoryService: { createAdjustment: jest.Mock };

  beforeEach(async () => {
    prisma = createPrismaMock();
    inventoryService = { createAdjustment: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        ProductService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: InventoryService,
          useValue: inventoryService,
        },
      ],
    }).compile();

    service = module.get(ProductService);
  });

  describe('getProducts', () => {
    it('returns paginated results with nextCursor when full page and default sort', async () => {
      const items = [
        { id: '1', createdAt: new Date() },
        { id: '2', createdAt: new Date() },
      ] as any[];
      prisma.paginateMany.mockResolvedValue(items);

      const res = await service.getProducts('org-1', {
        limit: 2,
        cursor: undefined,
        sortBy: undefined,
        sortOrder: undefined,
      } as any);

      expect(prisma.paginateMany).toHaveBeenCalledWith(
        prisma.product,
        { where: { organizationId: 'org-1' } },
        expect.objectContaining({ limit: 2, orderBy: { createdAt: 'desc' } }),
      );
      expect(res).toEqual({ data: items, totalCount: 2, nextCursor: '2' });
    });

    it('uses provided sort and omits nextCursor on last page', async () => {
      const items = [{ id: '1', createdAt: new Date() }] as any[];
      prisma.paginateMany.mockResolvedValue(items);

      const res = await service.getProducts('org-1', {
        limit: 2,
        cursor: '0',
        sortBy: 'priceCents',
        sortOrder: 'asc',
      } as any);

      expect(prisma.paginateMany).toHaveBeenCalledWith(
        prisma.product,
        { where: { organizationId: 'org-1' } },
        { limit: 2, cursor: '0', orderBy: { priceCents: 'asc' } },
      );
      expect(res).toEqual({
        data: items,
        totalCount: 1,
        nextCursor: undefined,
      });
    });
  });

  describe('getProductById', () => {
    it('returns the product when found', async () => {
      (prisma.product.findFirst as jest.Mock).mockResolvedValue({ id: 'p1' });
      const res = await service.getProductById('org', 'p1');
      expect(prisma.product.findFirst).toHaveBeenCalledWith({
        where: { id: 'p1', organizationId: 'org' },
      });
      expect(res).toEqual({ id: 'p1' });
    });

    it('throws NotFoundException when missing', async () => {
      (prisma.product.findFirst as jest.Mock).mockResolvedValue(null as any);
      await expect(
        service.getProductById('org', 'nope'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('createProduct', () => {
    it('creates with active=true and organizationId', async () => {
      const body = { name: 'Widget', sku: 'W-1', priceCents: 1000 } as any;
      const created = { id: 'p1', active: true, ...body };
      (prisma.product.create as jest.Mock).mockResolvedValue(created);

      const res = await service.createProduct('org-1', body);

      expect(prisma.product.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ...body,
          organizationId: 'org-1',
          active: true,
        }),
      });
      expect(res).toEqual({ product: created });
    });

    it('creates a product with inventory and associated adjustment', async () => {
      // Define data
      const organizationId = 'org-1';
      const actorUserId = 'usr-1';
      const locationId = 'loc-1';
      const productId = 'p1';

      const inventoryBody = { locationId, quantity: 300 };
      const productBody = {
        name: 'Test Product',
        sku: 'TP-1',
        priceCents: 1000,
      };

      // Define created objects
      const createdProduct = { id: productId, active: true, ...productBody };
      const createdInventoryLevel = {
        id: 'il1',
        productId: createdProduct.id,
        ...inventoryBody,
      };
      const createdAdjustment = {
        id: 'adj-1',
        locationId,
        actorUserId,
        productId,
        organizationId,
        delta: inventoryBody.quantity,
        reason: 'Initial stock creation',
      };

      // Setup mocks
      (prisma.product.create as jest.Mock).mockResolvedValue(createdProduct);
      inventoryService.createAdjustment.mockResolvedValue({
        inventoryLevel: createdInventoryLevel,
        adjustment: createdAdjustment,
      });

      const body = {
        ...productBody,
        inventory: inventoryBody,
      };
      const res = await service.createProduct(
        organizationId,
        body,
        actorUserId,
      );

      expect(res).toEqual({
        product: createdProduct,
        inventoryLevel: createdInventoryLevel,
        adjustment: createdAdjustment,
      });
    });
  });

  describe('updateProduct', () => {
    it('updates with composite where and partial data', async () => {
      const updated = { id: 'p1', name: 'New' } as any;
      (prisma.product.update as jest.Mock).mockResolvedValue(updated);

      const res = await service.updateProduct('org-1', 'p1', { name: 'New' });

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { organizationId: 'org-1', id: 'p1' },
        data: { name: 'New' },
      });
      expect(res).toBe(updated);
    });
  });

  describe('deleteProduct', () => {
    it('deletes with composite where', async () => {
      const deleted = { id: 'p1' } as any;
      (prisma.product.delete as jest.Mock).mockResolvedValue(deleted);

      const res = await service.deleteProduct('org-1', 'p1');

      expect(prisma.product.delete).toHaveBeenCalledWith({
        where: { organizationId: 'org-1', id: 'p1' },
      });
      expect(res).toBe(deleted);
    });
  });
});
