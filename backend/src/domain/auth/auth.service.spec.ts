import { Test } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@src/prisma/prisma.service';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { createPrismaMock } from '@src/test-utils/prisma.mock';

jest.mock('bcryptjs');

describe('AuthService', () => {
  let service: AuthService;
  let prisma: jest.Mocked<PrismaService>;
  let jwt: jest.Mocked<JwtService>;

  beforeEach(async () => {
    prisma = createPrismaMock();
    jwt = { signAsync: jest.fn() } as any;

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('login', () => {
    const baseUser = {
      id: 'u1',
      email: 'a@b.com',
      isActive: true,
      passwordHash: 'hash',
    } as any;

    it('returns tokens and user on success', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('rt-hash');
      prisma.refreshToken.create.mockResolvedValue({ id: 'rt1' } as any);
      prisma.user.update.mockResolvedValue({
        ...baseUser,
        passwordHash: undefined,
      } as any);
      prisma.membership.findMany.mockResolvedValue([{ id: 'm1' }] as any);
      jwt.signAsync.mockResolvedValue('access-token');

      const res = await service.login({ email: 'a@b.com', password: 'pw' });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'a@b.com' },
      });
      expect(bcrypt.compare).toHaveBeenCalled();
      expect(prisma.refreshToken.create).toHaveBeenCalled();
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: expect.any(Object),
        omit: { passwordHash: true },
      });
      expect(jwt.signAsync).toHaveBeenCalledWith({
        sub: 'u1',
        user: expect.any(Object),
      });
      expect(res).toMatchObject({
        accessToken: 'access-token',
        memberships: [{ id: 'm1' }],
      });
      expect(res.refreshToken).toBeDefined();
      expect(res.refreshTokenRaw).toBeDefined();
    });

    it('throws when user not found or inactive', async () => {
      prisma.user.findUnique.mockResolvedValue(null as any);
      await expect(
        service.login({ email: 'x@y.com', password: 'pw' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        isActive: false,
      } as any);
      await expect(
        service.login({ email: 'x@y.com', password: 'pw' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws when password invalid', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(
        service.login({ email: 'a@b.com', password: 'pw' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('issues new access token when refresh token valid', async () => {
      prisma.refreshToken.findMany.mockResolvedValue([
        { tokenHash: 'stored-hash' },
      ] as any);
      (bcrypt.compareSync as jest.Mock).mockReturnValueOnce(true);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        isActive: true,
      } as any);
      jwt.signAsync.mockResolvedValue('new-access');

      const res = await service.refresh({
        refreshTokenRaw: 'raw',
        userId: 'u1',
      });

      expect(prisma.refreshToken.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'u1',
          expiresAt: { gt: expect.any(Date) },
          revokedAt: null,
        },
      });
      expect(jwt.signAsync).toHaveBeenCalledWith({
        sub: 'u1',
        user: expect.any(Object),
      });
      expect(res).toEqual({
        accessToken: 'new-access',
        user: expect.any(Object),
      });
    });

    it('throws when no valid refresh tokens', async () => {
      prisma.refreshToken.findMany.mockResolvedValue([] as any);
      await expect(
        service.refresh({ refreshTokenRaw: 'raw', userId: 'u1' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws when provided token does not match any hash', async () => {
      prisma.refreshToken.findMany.mockResolvedValue([
        { tokenHash: 'x' },
        { tokenHash: 'y' },
      ] as any);
      (bcrypt.compareSync as jest.Mock).mockReturnValue(false);
      await expect(
        service.refresh({ refreshTokenRaw: 'raw', userId: 'u1' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws when user not found or inactive', async () => {
      prisma.refreshToken.findMany.mockResolvedValue([
        { tokenHash: 'x' },
      ] as any);
      (bcrypt.compareSync as jest.Mock).mockReturnValue(true);
      prisma.user.findUnique.mockResolvedValue({ isActive: false } as any);
      await expect(
        service.refresh({ refreshTokenRaw: 'raw', userId: 'u1' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('revokes all valid tokens for user', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 } as any);
      await service.logout('u1');
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'u1',
          expiresAt: { gt: expect.any(Date) },
          revokedAt: null,
        },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });
});
