import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CustomersDto,
  GetCustomersQueryParamDto,
  GetCustomersResponseDto,
} from './customer.dto';
import { CustomerStatus } from '@prisma/generated/client';

describe('GetCustomersQueryParamDto validation', () => {
  it('applies defaults and accepts valid values', async () => {
    const dto = plainToInstance(GetCustomersQueryParamDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.limit).toBe(20);
    expect(dto.sortOrder).toBe('desc');
  });

  it('rejects limit < 1 and > 100', async () => {
    const low = plainToInstance(GetCustomersQueryParamDto, { limit: 0 });
    const lowErrors = await validate(low);
    expect(lowErrors.length).toBeGreaterThan(0);

    const high = plainToInstance(GetCustomersQueryParamDto, { limit: 101 });
    const highErrors = await validate(high);
    expect(highErrors.length).toBeGreaterThan(0);
  });

  it('rejects invalid sortOrder', async () => {
    const dto = plainToInstance(GetCustomersQueryParamDto, { sortOrder: 'up' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('CustomersDto validation', () => {
  const valid = {
    id: 'a5b2b7f0-ec1b-4a0a-9e08-7e2dd6e7d5a0',
    organizationId: '0b5f7ae8-5835-4ef4-bfb7-7d1b2d8d9d1a',
    name: 'John Doe',
    email: 'john@doe.com',
    phone: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    status: CustomerStatus.ACTIVE,
    internalNote: null,
  };

  it('accepts a valid customer', async () => {
    const dto = plainToInstance(CustomersDto, valid);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid fields', async () => {
    const bad = {
      ...valid,
      id: 'not-uuid',
      email: 'bad',
      createdAt: 'x',
      status: 'NOPE',
    };
    const dto = plainToInstance(CustomersDto, bad);
    const errors = await validate(dto);
    expect(errors.length).toBe(4);
  });
});

describe('GetCustomersResponseDto validation', () => {
  it('validates nested data and totals', async () => {
    const payload = {
      data: [
        {
          id: 'a5b2b7f0-ec1b-4a0a-9e08-7e2dd6e7d5a0',
          organizationId: '0b5f7ae8-5835-4ef4-bfb7-7d1b2d8d9d1a',
          name: 'Jane',
          email: 'jane@doe.com',
          phone: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          status: CustomerStatus.ACTIVE,
          internalNote: null,
        },
      ],
      totalCount: 1,
      nextCursor: undefined,
    };
    const dto = plainToInstance(GetCustomersResponseDto, payload);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects when data invalid', async () => {
    const payload = { data: [{}], totalCount: 'one' };
    const dto = plainToInstance(GetCustomersResponseDto, payload);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
