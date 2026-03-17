import { Test } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { PrismaService } from '@src/infra/prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { createPrismaMock } from '@src/test-utils/prisma.mock';
import { productsWithInventory } from '@src/test-utils/fixtures';

describe('InventoryService', () => {
  let service: InventoryService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    prisma = createPrismaMock();

    const module = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(InventoryService);
  });

  describe('getInventory', () => {
    it('finds all products by organization id and aggregates their inventory', async () => {
      (prisma.product.findMany as jest.Mock).mockResolvedValue(
        productsWithInventory.slice(0, 2),
      );

      const res = await service.getInventory('org-1');

      expect(res).toEqual([
        {
          productId: 'prod-1',
          name: 'Prod 1',
          sku: 'PRO-1',
          totalQuantity: 200,
          locations: [
            { locationId: 'loc-2', quantity: 100 },
            { locationId: 'loc-1', quantity: 100 },
          ],
        },
        {
          productId: 'prod-2',
          name: 'Prod 2',
          sku: 'PRO-2',
          totalQuantity: 200,
          locations: [
            { locationId: 'loc-2', quantity: 100 },
            { locationId: 'loc-1', quantity: 100 },
          ],
        },
      ]);
    });
  });

  describe('getLevels', () => {
    it('returns paginated results with nextCursor when full page and default sort', async () => {
      const items = [
        { id: 'lvl-1', updatedAt: new Date() },
        { id: 'lvl-2', updatedAt: new Date() },
      ] as any[];
      prisma.paginateMany.mockResolvedValue(items);

      const res = await service.getLevels({
        limit: 2,
        cursor: undefined,
        sortBy: undefined,
        sortOrder: undefined,
        productId: undefined,
        locationId: undefined,
      } as any);

      expect(prisma.paginateMany).toHaveBeenCalledWith(
        // model
        (prisma as any).inventoryLevel,
        // query
        expect.objectContaining({
          where: { product: { id: undefined }, location: { id: undefined } },
          include: { product: true, location: true },
          omit: { productId: true, locationId: true },
        }),
        // pagination options
        expect.objectContaining({ limit: 2, orderBy: { updatedAt: 'desc' } }),
      );

      expect(res).toEqual({ data: items, totalCount: 2, nextCursor: 'lvl-2' });
    });

    it('uses provided sort and cursor and omits nextCursor on last page', async () => {
      const items = [{ id: 'lvl-9', updatedAt: new Date() }] as any[];
      prisma.paginateMany.mockResolvedValue(items);

      const res = await service.getLevels({
        limit: 2,
        cursor: 'lvl-0',
        sortBy: 'quantity',
        sortOrder: 'asc',
        productId: 'prod-1',
        locationId: 'loc-1',
      } as any);

      expect(prisma.paginateMany).toHaveBeenCalledWith(
        (prisma as any).inventoryLevel,
        expect.objectContaining({
          where: { product: { id: 'prod-1' }, location: { id: 'loc-1' } },
          include: { product: true, location: true },
          omit: { productId: true, locationId: true },
        }),
        { limit: 2, cursor: 'lvl-0', orderBy: { quantity: 'asc' } },
      );
      expect(res).toEqual({
        data: items,
        totalCount: 1,
        nextCursor: undefined,
      });
    });
  });

  describe('createAdjustment', () => {
    const base = {
      organizationId: 'org-1',
      productId: 'prod-1',
      locationId: 'loc-1',
      actorUserId: 'user-1',
      delta: 3,
      reason: 'STOCKTAKE',
      note: 'Initial count',
    } as const;

    it('it creates an inventory level if no matching one is found', async () => {
      (prisma as any).inventoryLevel.findFirst.mockResolvedValue(null);
      (prisma.inventoryLevel.create as jest.Mock).mockResolvedValue({
        productId: base.productId,
        locationId: base.locationId,
        quantity: 0,
      });

      await service.createAdjustment(base);

      expect((prisma as any).inventoryLevel.findFirst).toHaveBeenCalledWith({
        where: { productId: 'prod-1', locationId: 'loc-1' },
      });
      expect(prisma.inventoryLevel.create).toHaveBeenCalledWith({
        data: {
          productId: base.productId,
          locationId: base.locationId,
          quantity: 0,
        },
      });
    });

    it('throws BadRequestException when delta would make quantity negative', async () => {
      (prisma as any).inventoryLevel.findFirst.mockResolvedValue({
        id: 'lvl-1',
        quantity: 1,
      });

      await expect(
        service.createAdjustment({ ...base, delta: -2 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('updates level with new quantity and creates adjustment', async () => {
      (prisma as any).inventoryLevel.findFirst.mockResolvedValue({
        id: 'lvl-2',
        quantity: 5,
      });

      const updatedLevel = { id: 'lvl-2', quantity: 8 } as any;
      (prisma as any).inventoryLevel.update.mockResolvedValue(updatedLevel);

      const createdAdjustment = { id: 'adj-1', ...base } as any;
      (prisma as any).inventoryAdjustment.create.mockResolvedValue(
        createdAdjustment,
      );

      const res = await service.createAdjustment(base);

      expect((prisma as any).inventoryLevel.update).toHaveBeenCalledWith({
        where: { id: 'lvl-2' },
        data: { quantity: 8 },
      });
      expect((prisma as any).inventoryAdjustment.create).toHaveBeenCalledWith({
        data: base,
      });
      expect(res).toEqual({
        inventoryLevel: updatedLevel,
        adjustment: createdAdjustment,
      });
    });
  });

  describe('createLevel', () => {
    it('throws NotFoundException when product not found', async () => {
      (prisma as any).product.findFirst.mockResolvedValue(null);
      await expect(
        service.createLevel('org-1', {
          productId: 'prod-1',
          locationId: 'loc-1',
          quantity: 0,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFoundException when location not found', async () => {
      (prisma as any).product.findFirst.mockResolvedValue({ id: 'prod-1' });
      (prisma as any).location.findFirst.mockResolvedValue(null);

      await expect(
        service.createLevel('org-1', {
          productId: 'prod-1',
          locationId: 'loc-1',
          quantity: 0,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('creates level with provided quantity', async () => {
      (prisma as any).product.findFirst.mockResolvedValue({ id: 'prod-1' });
      (prisma as any).location.findFirst.mockResolvedValue({ id: 'loc-1' });
      const created = {
        id: 'lvl-1',
        productId: 'prod-1',
        locationId: 'loc-1',
        quantity: 7,
      } as any;
      (prisma as any).inventoryLevel.create.mockResolvedValue(created);

      const res = await service.createLevel('org-1', {
        productId: 'prod-1',
        locationId: 'loc-1',
        quantity: 7,
      });

      expect((prisma as any).inventoryLevel.create).toHaveBeenCalledWith({
        data: { productId: 'prod-1', locationId: 'loc-1', quantity: 7 },
      });
      expect(res).toBe(created);
    });

    it('defaults quantity to 0 when undefined', async () => {
      (prisma as any).product.findFirst.mockResolvedValue({ id: 'prod-1' });
      (prisma as any).location.findFirst.mockResolvedValue({ id: 'loc-1' });
      const created = {
        id: 'lvl-1',
        productId: 'prod-1',
        locationId: 'loc-1',
        quantity: 0,
      } as any;
      (prisma as any).inventoryLevel.create.mockResolvedValue(created);

      const res = await service.createLevel('org-1', {
        productId: 'prod-1',
        locationId: 'loc-1',
      } as any);

      expect((prisma as any).inventoryLevel.create).toHaveBeenCalledWith({
        data: { productId: 'prod-1', locationId: 'loc-1', quantity: 0 },
      });
      expect(res).toBe(created);
    });
  });

  describe('updateLevel', () => {
    it('throws NotFoundException when not found in organization scope', async () => {
      (prisma as any).inventoryLevel.findFirst.mockResolvedValue(null);

      await expect(
        service.updateLevel('org-1', 'lvl-1', { quantity: 2 }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect((prisma as any).inventoryLevel.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'lvl-1',
          product: { organizationId: 'org-1' },
          location: { organizationId: 'org-1' },
        },
      });
    });

    it('updates when found', async () => {
      (prisma as any).inventoryLevel.findFirst.mockResolvedValue({
        id: 'lvl-1',
      });
      const updated = { id: 'lvl-1', quantity: 10 } as any;
      (prisma as any).inventoryLevel.update.mockResolvedValue(updated);

      const res = await service.updateLevel('org-1', 'lvl-1', { quantity: 10 });

      expect((prisma as any).inventoryLevel.update).toHaveBeenCalledWith({
        where: { id: 'lvl-1' },
        data: { quantity: 10 },
      });
      expect(res).toBe(updated);
    });
  });

  describe('deleteLevel', () => {
    it('throws NotFoundException when not found', async () => {
      (prisma as any).inventoryLevel.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteLevel('org-1', 'lvl-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('deletes when found', async () => {
      (prisma as any).inventoryLevel.findFirst.mockResolvedValue({
        id: 'lvl-1',
      });
      const deleted = { id: 'lvl-1' } as any;
      (prisma as any).inventoryLevel.delete.mockResolvedValue(deleted);

      const res = await service.deleteLevel('org-1', 'lvl-1');

      expect((prisma as any).inventoryLevel.delete).toHaveBeenCalledWith({
        where: { id: 'lvl-1' },
      });
      expect(res).toBe(deleted);
    });
  });
});
