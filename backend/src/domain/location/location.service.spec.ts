import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@src/infra/prisma/prisma.service';
import { createPrismaMock } from '@src/test-utils/prisma.mock';
import { LocationService } from './location.service';

describe('LocationService', () => {
  let service: LocationService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    prisma = createPrismaMock();

    const module = await Test.createTestingModule({
      providers: [
        LocationService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(LocationService);
  });

  describe('getLocations', () => {
    it('lists locations and computes onHandQuantity', async () => {
      prisma.paginateMany.mockResolvedValue({
        data: [
          {
            id: 'loc-1',
            inventoryLevels: [{ quantity: 5 }, { quantity: 7 }],
          },
        ] as any,
        total: 1,
        nextCursor: undefined,
      });

      const result = await service.getLocations('org-1', {
        limit: 20,
      } as any);

      expect(prisma.paginateMany).toHaveBeenCalledWith(
        prisma.location,
        expect.objectContaining({
          where: {
            organizationId: 'org-1',
            status: { not: 'ARCHIVED' },
          },
        }),
        expect.objectContaining({
          orderBy: { updatedAt: 'desc' },
        }),
      );
      expect(result).toEqual({
        data: [
          {
            id: 'loc-1',
            inventoryLevels: [{ quantity: 5 }, { quantity: 7 }],
            onHandQuantity: 12,
          },
        ],
        totalCount: 1,
        nextCursor: undefined,
      });
    });

    it('applies search, status, and type filters', async () => {
      prisma.paginateMany.mockResolvedValue({
        data: [],
        total: 0,
        nextCursor: undefined,
      });

      await service.getLocations('org-1', {
        limit: 20,
        search: 'montreal',
        status: 'ACTIVE',
        type: 'STORE',
      } as any);

      expect(prisma.paginateMany).toHaveBeenCalledWith(
        prisma.location,
        expect.objectContaining({
          where: {
            organizationId: 'org-1',
            status: 'ACTIVE',
            type: 'STORE',
            OR: [
              { name: { contains: 'montreal', mode: 'insensitive' } },
              { code: { contains: 'montreal', mode: 'insensitive' } },
              { addressLine1: { contains: 'montreal', mode: 'insensitive' } },
              { city: { contains: 'montreal', mode: 'insensitive' } },
            ],
          },
        }),
        expect.anything(),
      );
    });
  });

  describe('getLocationById', () => {
    it('returns a location when found', async () => {
      (prisma.location.findFirst as jest.Mock).mockResolvedValue({
        id: 'loc-1',
      });

      await expect(service.getLocationById('org-1', 'loc-1')).resolves.toEqual({
        id: 'loc-1',
      });
    });

    it('throws when not found', async () => {
      (prisma.location.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.getLocationById('org-1', 'loc-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('createLocation', () => {
    it('creates an org-scoped location', async () => {
      (prisma.location.create as jest.Mock).mockResolvedValue({ id: 'loc-1' });

      await service.createLocation('org-1', { name: 'HQ' } as any);

      expect(prisma.location.create).toHaveBeenCalledWith({
        data: {
          name: 'HQ',
          organizationId: 'org-1',
        },
      });
    });
  });

  describe('updateLocation', () => {
    beforeEach(() => {
      (prisma.location.findFirst as jest.Mock).mockResolvedValue({
        id: 'loc-1',
      });
    });

    it('updates a location when archiving is allowed', async () => {
      (prisma.inventoryLevel.count as jest.Mock).mockResolvedValue(0);
      (prisma.location.update as jest.Mock).mockResolvedValue({ id: 'loc-1' });

      await service.updateLocation('org-1', 'loc-1', {
        status: 'ARCHIVED',
      } as any);

      expect(prisma.location.update).toHaveBeenCalledWith({
        where: { id: 'loc-1', organizationId: 'org-1' },
        data: { status: 'ARCHIVED' },
      });
    });

    it('blocks archiving when stock exists', async () => {
      (prisma.inventoryLevel.count as jest.Mock).mockResolvedValue(3);

      await expect(
        service.updateLocation('org-1', 'loc-1', {
          status: 'ARCHIVED',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('deleteLocation', () => {
    beforeEach(() => {
      (prisma.location.findFirst as jest.Mock).mockResolvedValue({
        id: 'loc-1',
      });
    });

    it('deletes a location when allowed', async () => {
      (prisma.location.count as jest.Mock).mockResolvedValue(2);
      (prisma.inventoryLevel.count as jest.Mock).mockResolvedValue(0);
      (prisma.location.delete as jest.Mock).mockResolvedValue({ id: 'loc-1' });

      await service.deleteLocation('org-1', 'loc-1');

      expect(prisma.location.delete).toHaveBeenCalledWith({
        where: { id: 'loc-1', organizationId: 'org-1' },
      });
    });

    it('blocks deletion when it is the only location', async () => {
      (prisma.location.count as jest.Mock).mockResolvedValue(1);

      await expect(
        service.deleteLocation('org-1', 'loc-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('blocks deletion when stock exists', async () => {
      (prisma.location.count as jest.Mock).mockResolvedValue(2);
      (prisma.inventoryLevel.count as jest.Mock).mockResolvedValue(1);

      await expect(
        service.deleteLocation('org-1', 'loc-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
