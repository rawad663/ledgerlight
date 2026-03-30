import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateAdjustmentBodyDto,
  GetInventoryLevelsResponseDto,
  GetLevelsQueryDto,
  InventoryAdjustmentDto,
  InventoryLevelDto,
  InventoryLevelsDataDto,
} from './inventory.dto';

const validUuid = 'a5b2b7f0-ec1b-4a0a-9e08-7e2dd6e7d5a0';

describe('Inventory DTO validation', () => {
  describe('InventoryLevelDto', () => {
    const base = {
      id: validUuid,
      productId: validUuid,
      locationId: validUuid,
      quantity: 10,
      updatedAt: new Date(),
      createdAt: new Date(),
    };

    it('accepts a valid level', async () => {
      const dto = plainToInstance(InventoryLevelDto, base);
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('rejects invalid fields', async () => {
      const bad = {
        ...base,
        id: 'nope',
        productId: 'also-bad',
        locationId: 'x',
        quantity: -1,
        updatedAt: 'y',
      } as any;
      const dto = plainToInstance(InventoryLevelDto, bad);
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('GetLevelsQueryDto', () => {
    it('accepts optional filters', async () => {
      const dto = plainToInstance(GetLevelsQueryDto, {
        productId: validUuid,
        locationId: validUuid,
        limit: 10,
        cursor: undefined,
        sortBy: 'updatedAt',
        sortOrder: 'asc',
      });
      const errors = await validate(dto, { forbidUnknownValues: false });
      expect(errors).toHaveLength(0);
    });

    it('rejects invalid uuids', async () => {
      const dto = plainToInstance(GetLevelsQueryDto, {
        productId: 'bad',
        locationId: 'nope',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('InventoryLevelsDataDto', () => {
    const product = {
      id: validUuid,
      organizationId: validUuid,
      name: 'Widget',
      sku: 'WID-001',
      priceCents: 1000,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const location = {
      id: validUuid,
      organizationId: validUuid,
      name: 'Main',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('accepts valid nested product and location', async () => {
      const dto = plainToInstance(InventoryLevelsDataDto, {
        id: validUuid,
        quantity: 5,
        updatedAt: new Date(),
        createdAt: new Date(),
        product,
        location,
      });
      const errors = await validate(dto, { forbidUnknownValues: false });
      expect(errors).toHaveLength(0);
    });

    it('rejects when nested invalid', async () => {
      const dto = plainToInstance(InventoryLevelsDataDto, {
        id: 'bad',
        quantity: -2,
        updatedAt: 'x',
        product: { id: 'x' },
        location: { id: 'y' },
      } as any);
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('InventoryAdjustmentDto', () => {
    const base = {
      id: validUuid,
      organizationId: validUuid,
      productId: validUuid,
      locationId: validUuid,
      actorUserId: validUuid,
      delta: 3,
      reason: 'MANUAL',
      note: 'Adjusted',
      createdAt: new Date(),
    };

    it('accepts a valid adjustment', async () => {
      const dto = plainToInstance(InventoryAdjustmentDto, base);
      const errors = await validate(dto, { forbidUnknownValues: false });
      expect(errors).toHaveLength(0);
    });

    it('rejects invalid fields', async () => {
      const bad = {
        ...base,
        id: 'x',
        organizationId: 'y',
        productId: 'z',
        locationId: 'w',
        actorUserId: 'v',
        delta: 'a',
        createdAt: 'b',
      } as any;
      const dto = plainToInstance(InventoryAdjustmentDto, bad);
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('CreateAdjustmentBodyDto', () => {
    it('accepts a valid payload', async () => {
      const dto = plainToInstance(CreateAdjustmentBodyDto, {
        productId: validUuid,
        locationId: validUuid,
        delta: 1,
        reason: 'MANUAL',
        note: 'Note',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('rejects missing required fields', async () => {
      const dto = plainToInstance(CreateAdjustmentBodyDto, {
        reason: 'x',
      } as any);
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('GetInventoryLevelsResponseDto', () => {
    it('validates nested array and pagination fields', async () => {
      const payload = {
        data: [
          {
            id: validUuid,
            quantity: 2,
            updatedAt: new Date(),
            createdAt: new Date(),
            product: {
              id: validUuid,
              organizationId: validUuid,
              name: 'Widget',
              sku: 'WID-001',
              priceCents: 100,
              active: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            location: {
              id: validUuid,
              organizationId: validUuid,
              name: 'Main',
              code: null,
              type: 'STORE',
              status: 'ACTIVE',
              addressLine1: '123 Main St',
              addressLine2: null,
              city: 'Springfield',
              stateProvince: 'IL',
              postalCode: '62701',
              countryCode: 'US',
              notes: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
        ],
        totalCount: 1,
        nextCursor: undefined,
        locations: [
          {
            id: validUuid,
            organizationId: validUuid,
            name: 'Main',
            code: null,
            type: 'STORE',
            status: 'ACTIVE',
            addressLine1: '123 Main St',
            addressLine2: null,
            city: 'Springfield',
            stateProvince: 'IL',
            postalCode: '62701',
            countryCode: 'US',
            notes: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        lowStockCount: 2,
      };
      const dto = plainToInstance(GetInventoryLevelsResponseDto, payload);
      const errors = await validate(dto, { forbidUnknownValues: false });
      expect(errors).toHaveLength(0);
    });

    it('rejects when payload invalid', async () => {
      const dto = plainToInstance(GetInventoryLevelsResponseDto, {
        data: [{}],
        totalCount: 'one',
      } as any);
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
