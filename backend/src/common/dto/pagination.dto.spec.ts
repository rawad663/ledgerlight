import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PaginationOptionsQueryParamDto } from './pagination.dto';
describe('PaginationOptionsQueryParamDto validation', () => {
  it('applies defaults and accepts valid values', async () => {
    const dto = plainToInstance(PaginationOptionsQueryParamDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.limit).toBe(20);
    expect(dto.sortOrder).toBe('desc');
  });

  it('rejects limit < 1 and > 100', async () => {
    const low = plainToInstance(PaginationOptionsQueryParamDto, { limit: 0 });
    const lowErrors = await validate(low);
    expect(lowErrors.length).toBeGreaterThan(0);

    const high = plainToInstance(PaginationOptionsQueryParamDto, {
      limit: 101,
    });
    const highErrors = await validate(high);
    expect(highErrors.length).toBeGreaterThan(0);
  });

  it('rejects invalid sortOrder', async () => {
    const dto = plainToInstance(PaginationOptionsQueryParamDto, {
      sortOrder: 'up',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
