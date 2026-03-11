import { Test } from '@nestjs/testing';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '@src/prisma/prisma.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  const prisma = { membership: { findMany: jest.fn() } } as any;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = 'test-secret';

    const module = await Test.createTestingModule({
      providers: [JwtStrategy, { provide: PrismaService, useValue: prisma }],
    }).compile();
    strategy = module.get(JwtStrategy);
  });

  it('throws when payload is invalid', async () => {
    await expect(strategy.validate({} as any)).rejects.toThrow(
      'Invalid token payload',
    );
  });

  it('returns user with memberships on success', async () => {
    prisma.membership.findMany.mockResolvedValue([{ id: 'm1' }]);
    const res = await strategy.validate({
      sub: 'u1',
      user: { id: 'u1', email: 'a@b.com' },
    } as any);
    expect(prisma.membership.findMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
    });
    expect(res).toMatchObject({ id: 'u1', memberships: [{ id: 'm1' }] });
  });
});
