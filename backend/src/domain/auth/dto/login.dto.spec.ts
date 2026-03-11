import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { LoginDto, RefreshTokenDto } from './login.dto';

describe('LoginDto validation', () => {
  it('accepts valid payload', async () => {
    const dto = plainToInstance(LoginDto, {
      email: 'a@b.com',
      password: 'password123',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid email and short password', async () => {
    const dto = plainToInstance(LoginDto, {
      email: 'not-email',
      password: 'short',
    });
    const errors = await validate(dto);
    const props = errors.map((e) => e.property);
    expect(props).toEqual(expect.arrayContaining(['email', 'password']));
  });
});

describe('RefreshTokenDto validation', () => {
  it('accepts valid payload', async () => {
    const dto = plainToInstance(RefreshTokenDto, {
      refreshTokenRaw: 'raw',
      userId: 'a5b2b7f0-ec1b-4a0a-9e08-7e2dd6e7d5a0',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid uuid', async () => {
    const dto = plainToInstance(RefreshTokenDto, {
      refreshTokenRaw: 'raw',
      userId: 'not-uuid',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'userId')).toBe(true);
  });
});
