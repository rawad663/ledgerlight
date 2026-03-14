import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GetProductsResponseDto, ProductDto } from './product.dto';

describe('ProductDto validation', () => {
  const valid = {
    id: 'a5b2b7f0-ec1b-4a0a-9e08-7e2dd6e7d5a0',
    organizationId: '0b5f7ae8-5835-4ef4-bfb7-7d1b2d8d9d1a',
    name: 'Widget',
    sku: 'WID-001',
    priceCents: 1500,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('accepts a valid product', async () => {
    const dto = plainToInstance(ProductDto, valid);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid fields', async () => {
    const bad = {
      ...valid,
      id: 'not-uuid',
      organizationId: 'also-bad',
      priceCents: -10,
      active: 'yes',
      createdAt: 'x',
    } as any;
    const dto = plainToInstance(ProductDto, bad);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThanOrEqual(4);
  });
});

describe('GetProductsResponseDto validation', () => {
  it('validates nested data and totals', async () => {
    const payload = {
      data: [
        {
          id: 'a5b2b7f0-ec1b-4a0a-9e08-7e2dd6e7d5a0',
          organizationId: '0b5f7ae8-5835-4ef4-bfb7-7d1b2d8d9d1a',
          name: 'Widget',
          sku: 'WID-001',
          priceCents: 1500,
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      totalCount: 1,
      nextCursor: undefined,
    };
    const dto = plainToInstance(GetProductsResponseDto, payload);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects when data invalid', async () => {
    const payload = { data: [{}], totalCount: 'one' } as any;
    const dto = plainToInstance(GetProductsResponseDto, payload);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
