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

      const query = {
        limit: 20,
        cursor: undefined,
        sortBy: undefined,
        sortOrder: undefined,
      } as any;
      const res = await service.getInventory('org-1', query);

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1' },
          include: {
            inventoryLevels: {
              include: {
                location: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        }),
      );
      expect(res).toEqual({
        data: [
          {
            productId: 'prod-1',
            name: 'Prod 1',
            sku: 'PRO-1',
            totalQuantity: 200,
            reorderThreshold: 10,
            stockGap: 0,
            isLowStock: false,
            locations: [
              { locationId: 'loc-1', locationName: 'Downtown', quantity: 100 },
              { locationId: 'loc-2', locationName: 'Uptown', quantity: 100 },
            ],
          },
          {
            productId: 'prod-2',
            name: 'Prod 2',
            sku: 'PRO-2',
            totalQuantity: 200,
            reorderThreshold: 10,
            stockGap: 0,
            isLowStock: false,
            locations: [
              { locationId: 'loc-1', locationName: 'Downtown', quantity: 100 },
              { locationId: 'loc-2', locationName: 'Uptown', quantity: 100 },
            ],
          },
        ],
        totalCount: 2,
        nextCursor: undefined,
      });
    });

    it('filters and sorts low-stock products by stock gap', async () => {
      (prisma.product.findMany as jest.Mock).mockResolvedValue([
        {
          ...productsWithInventory[0],
          reorderThreshold: 250,
        },
        {
          ...productsWithInventory[1],
          reorderThreshold: 205,
        },
      ]);

      const res = await service.getInventory('org-1', {
        limit: 20,
        lowStockOnly: true,
        sortBy: 'stockGap',
        sortOrder: 'desc',
      } as any);

      expect(res).toEqual({
        data: [
          expect.objectContaining({
            productId: 'prod-1',
            stockGap: 50,
            isLowStock: true,
          }),
          expect.objectContaining({
            productId: 'prod-2',
            stockGap: 5,
            isLowStock: true,
          }),
        ],
        totalCount: 2,
        nextCursor: undefined,
      });
    });
  });

  describe('getLevels', () => {
    const mockLocations = [
      { id: 'loc-1', name: 'Downtown', organizationId: 'org-1' },
      { id: 'loc-2', name: 'Uptown', organizationId: 'org-1' },
    ];

    beforeEach(() => {
      (prisma as any).location.findMany.mockResolvedValue(mockLocations);
    });

    it('returns paginated results with locations and lowStockCount', async () => {
      const items = [
        {
          id: 'lvl-1',
          quantity: 4,
          createdAt: new Date('2026-03-01T10:00:00.000Z'),
          updatedAt: new Date('2026-03-01T10:00:00.000Z'),
          product: { id: 'prod-1', name: 'Prod 1', sku: 'PRO-1', reorderThreshold: 5 },
          location: { id: 'loc-1', name: 'Downtown', organizationId: 'org-1' },
        },
        {
          id: 'lvl-2',
          quantity: 12,
          createdAt: new Date('2026-03-02T10:00:00.000Z'),
          updatedAt: new Date('2026-03-02T10:00:00.000Z'),
          product: { id: 'prod-2', name: 'Prod 2', sku: 'PRO-2', reorderThreshold: 10 },
          location: { id: 'loc-2', name: 'Uptown', organizationId: 'org-1' },
        },
      ] as any[];

      (prisma.paginateMany as jest.Mock).mockResolvedValue({
        data: items,
        total: 2,
        nextCursor: undefined,
      });
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ count: 1n }]);

      const res = await service.getLevels('org-1', {
        limit: 2,
        cursor: undefined,
        sortBy: undefined,
        sortOrder: undefined,
        productId: undefined,
        locationId: undefined,
      } as any);

      expect(prisma.paginateMany).toHaveBeenCalledWith(
        prisma.inventoryLevel,
        expect.objectContaining({
          where: { product: { organizationId: 'org-1' } },
          include: { product: true, location: true },
        }),
        expect.objectContaining({ limit: 2 }),
      );

      expect(res).toEqual({
        data: items,
        totalCount: 2,
        nextCursor: undefined,
        locations: mockLocations,
        lowStockCount: 1,
      });
    });

    it('uses provided sort, cursor, and filters', async () => {
      const items = [
        {
          id: 'lvl-9',
          quantity: 2,
          createdAt: new Date('2026-03-02T10:00:00.000Z'),
          updatedAt: new Date('2026-03-02T10:00:00.000Z'),
          product: { id: 'prod-1', name: 'Prod 1', sku: 'PRO-1', reorderThreshold: 5 },
          location: { id: 'loc-1', name: 'Downtown', organizationId: 'org-1' },
        },
      ] as any[];

      (prisma.paginateMany as jest.Mock).mockResolvedValue({
        data: items,
        total: 1,
        nextCursor: undefined,
      });
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ count: 0n }]);

      const res = await service.getLevels('org-1', {
        limit: 2,
        cursor: 'lvl-0',
        sortBy: 'quantity',
        sortOrder: 'asc',
        productId: 'prod-1',
        locationId: 'loc-1',
      } as any);

      expect(prisma.paginateMany).toHaveBeenCalledWith(
        prisma.inventoryLevel,
        expect.objectContaining({
          where: {
            product: { organizationId: 'org-1', id: 'prod-1' },
            locationId: 'loc-1',
          },
          include: { product: true, location: true },
        }),
        expect.objectContaining({ cursor: 'lvl-0', orderBy: [{ quantity: 'asc' }, { product: { name: 'asc' } }] }),
      );

      expect(res).toEqual({
        data: items,
        totalCount: 1,
        nextCursor: undefined,
        locations: mockLocations,
        lowStockCount: 0,
      });
    });

    it('applies search filter on product name and SKU', async () => {
      (prisma.paginateMany as jest.Mock).mockResolvedValue({ data: [], total: 0, nextCursor: undefined });
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ count: 0n }]);

      await service.getLevels('org-1', { limit: 20, search: 'shirt' } as any);

      expect(prisma.paginateMany).toHaveBeenCalledWith(
        prisma.inventoryLevel,
        expect.objectContaining({
          where: {
            product: {
              organizationId: 'org-1',
              OR: [
                { name: { contains: 'shirt', mode: 'insensitive' } },
                { sku: { contains: 'shirt', mode: 'insensitive' } },
              ],
            },
          },
        }),
        expect.any(Object),
      );
    });

    it('applies lowStockOnly filter', async () => {
      (prisma.inventoryLevel.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'lvl-1',
          quantity: 4,
          createdAt: new Date(),
          updatedAt: new Date(),
          product: { id: 'prod-1', name: 'Prod 1', sku: 'PRO-1', reorderThreshold: 5 },
          location: { id: 'loc-1', name: 'Downtown', organizationId: 'org-1' },
        },
        {
          id: 'lvl-2',
          quantity: 6,
          createdAt: new Date(),
          updatedAt: new Date(),
          product: { id: 'prod-2', name: 'Prod 2', sku: 'PRO-2', reorderThreshold: 5 },
          location: { id: 'loc-2', name: 'Uptown', organizationId: 'org-1' },
        },
      ]);
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ count: 1n }]);

      const res = await service.getLevels('org-1', { limit: 20, lowStockOnly: true } as any);

      expect(res.data).toEqual([expect.objectContaining({ id: 'lvl-1', quantity: 4 })]);
    });
  });

  describe('createAdjustment', () => {
    const base = {
      organizationId: 'org-1',
      productId: 'prod-1',
      locationId: 'loc-1',
      actorUserId: 'user-1',
      delta: 3,
      reason: 'INITIAL_STOCK',
      note: 'Initial count',
    } as const;

    it('upserts an inventory level (creates when not found)', async () => {
      const upsertedLevel = { id: 'lvl-new', productId: base.productId, locationId: base.locationId, quantity: 0 } as any;
      (prisma as any).inventoryLevel.upsert.mockResolvedValue(upsertedLevel);
      (prisma as any).inventoryLevel.update.mockResolvedValue({ ...upsertedLevel, quantity: 3 });
      (prisma as any).inventoryAdjustment.create.mockResolvedValue({});

      await service.createAdjustment(base);

      expect((prisma as any).inventoryLevel.upsert).toHaveBeenCalledWith({
        where: {
          productId_locationId: { productId: 'prod-1', locationId: 'loc-1' },
        },
        create: { productId: base.productId, locationId: base.locationId, quantity: 0 },
        update: {},
      });
    });

    it('throws BadRequestException when delta would make quantity negative', async () => {
      (prisma as any).inventoryLevel.upsert.mockResolvedValue({
        id: 'lvl-1',
        quantity: 1,
      });

      await expect(
        service.createAdjustment({ ...base, delta: -2 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('updates level with new quantity and creates adjustment', async () => {
      (prisma as any).inventoryLevel.upsert.mockResolvedValue({
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
    it('propagates Prisma error when level not found in organization scope', async () => {
      const notFound = Object.assign(new Error('Not found'), { code: 'P2025' });
      (prisma as any).inventoryLevel.update.mockRejectedValue(notFound);

      await expect(
        service.updateLevel('org-1', 'lvl-1', { quantity: 2 }),
      ).rejects.toMatchObject({ code: 'P2025' });
    });

    it('updates when found', async () => {
      const updated = { id: 'lvl-1', quantity: 10 } as any;
      (prisma as any).inventoryLevel.update.mockResolvedValue(updated);

      const res = await service.updateLevel('org-1', 'lvl-1', { quantity: 10 });

      expect((prisma as any).inventoryLevel.update).toHaveBeenCalledWith({
        where: {
          id: 'lvl-1',
          product: { organizationId: 'org-1' },
          location: { organizationId: 'org-1' },
        },
        data: { quantity: 10 },
      });
      expect(res).toBe(updated);
    });
  });

  describe('deleteLevel', () => {
    it('propagates Prisma error when level not found', async () => {
      const notFound = Object.assign(new Error('Not found'), { code: 'P2025' });
      (prisma as any).inventoryLevel.delete.mockRejectedValue(notFound);

      await expect(
        service.deleteLevel('org-1', 'lvl-1'),
      ).rejects.toMatchObject({ code: 'P2025' });
    });

    it('deletes when found', async () => {
      const deleted = { id: 'lvl-1' } as any;
      (prisma as any).inventoryLevel.delete.mockResolvedValue(deleted);

      const res = await service.deleteLevel('org-1', 'lvl-1');

      expect((prisma as any).inventoryLevel.delete).toHaveBeenCalledWith({
        where: {
          id: 'lvl-1',
          product: { organizationId: 'org-1' },
          location: { organizationId: 'org-1' },
        },
      });
      expect(res).toBe(deleted);
    });
  });
});
