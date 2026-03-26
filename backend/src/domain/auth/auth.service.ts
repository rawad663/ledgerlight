import { JwtService } from '@nestjs/jwt';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

import { LoginDto, RefreshTokenDto } from './dto/login.dto';
import { PrismaService } from '@src/infra/prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prismaService: PrismaService,
  ) {}

  async login({ email, password }: LoginDto) {
    const user = await this.prismaService.user.findUnique({
      where: { email },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException(
        'Invalid credentials, user not found or inactive',
      );
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException(
        'Invalid credentials, incorrect password',
      );
    }

    const refreshTokenRaw = crypto.randomBytes(48).toString('base64url');
    const refreshTokenHash = await bcrypt.hash(refreshTokenRaw, 10);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const refreshToken = await this.prismaService.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt,
      },
      omit: { tokenHash: true },
    });

    const updatedUser = await this.prismaService.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
      omit: { passwordHash: true },
    });

    const memberships = await this.prismaService.membership.findMany({
      where: { userId: user.id },
      include: { organization: true },
    });

    const payload = {
      sub: user.id,
      user: updatedUser,
      memberships: memberships.map((m) => ({
        id: m.id,
        userId: m.userId,
        organizationId: m.organizationId,
        organizationName: m.organization.name,
        role: m.role,
      })),
    };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      refreshTokenRaw: refreshTokenRaw,
      refreshToken: refreshToken,
      user: updatedUser,
      memberships,
    };
  }

  async refresh({ refreshTokenRaw, userId }: RefreshTokenDto) {
    const validRefreshTokens = await this.prismaService.refreshToken.findMany({
      where: {
        userId,
        expiresAt: { gt: new Date() },
        revokedAt: null,
      },
    });

    if (!validRefreshTokens || validRefreshTokens.length === 0) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const results = await Promise.all(
      validRefreshTokens.map(({ tokenHash }) =>
        bcrypt.compare(refreshTokenRaw, tokenHash),
      ),
    );
    if (!results.some(Boolean)) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      omit: { passwordHash: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException(
        'Invalid refresh token, user not found or inactive',
      );
    }

    const memberships = await this.prismaService.membership.findMany({
      where: { userId: user.id },
      include: { organization: true },
    });

    const payload = {
      sub: user.id,
      user,
      memberships: memberships.map((m) => ({
        id: m.id,
        userId: m.userId,
        organizationId: m.organizationId,
        organizationName: m.organization.name,
        role: m.role,
      })),
    };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user,
    };
  }

  async logout(userId: string) {
    await this.prismaService.refreshToken.updateMany({
      where: {
        userId,
        expiresAt: { gt: new Date() },
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }
}
