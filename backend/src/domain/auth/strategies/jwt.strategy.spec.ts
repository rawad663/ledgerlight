import { Test } from '@nestjs/testing';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = 'test-secret';

    const module = await Test.createTestingModule({
      providers: [JwtStrategy],
    }).compile();
    strategy = module.get(JwtStrategy);
  });

  it('throws when payload is invalid', () => {
    expect(() => strategy.validate({} as any)).toThrow('Invalid token payload');
  });

  it('returns user with memberships on success', () => {
    const memberships = [
      { id: 'm1', organizationId: 'org-1', role: 'ADMIN', userId: 'u1' },
    ];
    const res = strategy.validate({
      sub: 'u1',
      user: { id: 'u1', email: 'a@b.com' },
      memberships,
    } as any);
    expect(res).toMatchObject({ id: 'u1', memberships });
  });
});
