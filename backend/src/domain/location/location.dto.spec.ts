import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  GetLocationsResponseDto,
  LocationDto,
  LocationListItemDto,
} from './location.dto';

describe('LocationDto validation', () => {
  const valid = {
    id: 'a5b2b7f0-ec1b-4a0a-9e08-7e2dd6e7d5a0',
    organizationId: '0b5f7ae8-5835-4ef4-bfb7-7d1b2d8d9d1a',
    name: 'Montreal QC',
    code: 'MTL',
    type: 'STORE',
    status: 'ACTIVE',
    addressLine1: '123 Main St',
    addressLine2: null,
    city: 'Montreal',
    stateProvince: 'QC',
    postalCode: 'H3B 1E2',
    countryCode: 'CA',
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('accepts a valid location', async () => {
    const dto = plainToInstance(LocationDto, valid);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid fields', async () => {
    const dto = plainToInstance(LocationDto, {
      ...valid,
      id: 'bad',
      organizationId: 'bad',
      type: 'INVALID',
      status: 'INVALID',
      createdAt: 'bad',
    } as any);

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThanOrEqual(5);
  });
});

describe('LocationListItemDto validation', () => {
  it('accepts valid computed quantities', async () => {
    const dto = plainToInstance(LocationListItemDto, {
      id: 'a5b2b7f0-ec1b-4a0a-9e08-7e2dd6e7d5a0',
      organizationId: '0b5f7ae8-5835-4ef4-bfb7-7d1b2d8d9d1a',
      name: 'Montreal QC',
      code: 'MTL',
      type: 'STORE',
      status: 'ACTIVE',
      addressLine1: '123 Main St',
      city: 'Montreal',
      countryCode: 'CA',
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      onHandQuantity: 12,
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});

describe('GetLocationsResponseDto validation', () => {
  it('validates nested location list items', async () => {
    const dto = plainToInstance(GetLocationsResponseDto, {
      data: [
        {
          id: 'a5b2b7f0-ec1b-4a0a-9e08-7e2dd6e7d5a0',
          organizationId: '0b5f7ae8-5835-4ef4-bfb7-7d1b2d8d9d1a',
          name: 'Montreal QC',
          code: 'MTL',
          type: 'STORE',
          status: 'ACTIVE',
          addressLine1: '123 Main St',
          city: 'Montreal',
          countryCode: 'CA',
          createdAt: new Date(),
          updatedAt: new Date(),
          onHandQuantity: 12,
        },
      ],
      totalCount: 1,
      nextCursor: undefined,
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
