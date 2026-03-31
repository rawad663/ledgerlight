import { Test } from '@nestjs/testing';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import {
  OrganizationContextGuard,
  JwtAuthGuard,
  PermissionsGuard,
} from '@src/common/guards';
import { PrismaService } from '@src/infra/prisma/prisma.service';

describe('InventoryController', () => {
  let controller: InventoryController;
  let service: jest.Mocked<InventoryService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [
        {
          provide: InventoryService,
          useValue: {
            getInventory: jest.fn(),
            getLevels: jest.fn(),
            createAdjustment: jest.fn(),
          },
        },
        {
          provide: OrganizationContextGuard,
          useValue: { canActivate: jest.fn().mockReturnValue(true) },
        },
        {
          provide: JwtAuthGuard,
          useValue: { canActivate: jest.fn().mockReturnValue(true) },
        },
        {
          provide: PermissionsGuard,
          useValue: { canActivate: jest.fn().mockReturnValue(true) },
        },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    controller = module.get(InventoryController);
    service = module.get(InventoryService);
  });

  describe('getInventory', () => {
    it('calls the service to aggregate inventory and return result', async () => {
      const org = { organizationId: 'org-1', role: 'ADMIN' };
      const query = { limit: 20 } as any;
      const result = {
        data: [
          {
            productId: '08395fd2-43b1-49b7-97ec-57c4f63194cb',
            name: 'Product X',
            sku: 'PROD-X',
            totalQuantity: 950,
            locations: [
              {
                locationId: 'loc-1',
                quantity: 950,
              },
            ],
          },
        ],
        totalCount: 1,
        nextCursor: undefined,
      };

      service.getInventory.mockResolvedValue(result as any);

      const res = await controller.getInventory(org, query);

      expect(service.getInventory).toHaveBeenCalledWith(
        org.organizationId,
        query,
      );
      expect(res).toBe(result);
    });
  });
  describe('getLevels', () => {
    it('forwards org and query to service and returns result', async () => {
      const org = { organizationId: 'org-1', role: 'ADMIN' };
      const query = {
        productId: 'prod-1',
        locationId: 'loc-1',
        limit: 10,
        cursor: undefined,
        sortBy: 'updatedAt',
        sortOrder: 'asc',
      } as any;
      const result = {
        data: [],
        totalCount: 0,
        nextCursor: undefined,
        locations: [],
        lowStockCount: 0,
      } as any;
      service.getLevels.mockResolvedValue(result);

      const res = await controller.getLevels(org, query);

      expect(service.getLevels).toHaveBeenCalledWith(org.organizationId, query);
      expect(res).toBe(result);
    });
  });

  describe('createAdjustment', () => {
    it('injects org and user context and forwards to service', async () => {
      const user = { id: 'user-1' } as any;
      const org = { organizationId: 'org-1', role: 'MANAGER' } as any;
      const body = {
        productId: 'prod-1',
        locationId: 'loc-1',
        delta: 5,
        reason: 'RECEIVE',
        note: 'Inbound shipment',
      } as any;
      const result = {
        inventoryLevel: { id: 'lvl-1' },
        adjustment: { id: 'adj-1' },
      } as any;
      service.createAdjustment.mockResolvedValue(result);

      const res = await controller.createAdjustment(user, org, body);

      expect(service.createAdjustment).toHaveBeenCalledWith({
        organizationId: 'org-1',
        actorUserId: 'user-1',
        ...body,
      });
      expect(res).toBe(result);
    });
  });
});
