import { JwtService } from '@nestjs/jwt';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

import { LoginDto } from './dto/login.dto';
import { PrismaService } from '@src/prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prismaService: PrismaService,
  ) {}

  async login({ email, password, organizationId }: LoginDto) {
    const user = await this.prismaService.user.findUnique({
      where: { email },
      include: { memberships: true },
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

    const validMembership = user.memberships.find(
      (membership) => membership.organizationId === organizationId,
    );
    if (!validMembership) {
      throw new UnauthorizedException(
        'User does not belong to the specified organization',
      );
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: validMembership.role,
      organizationId,
    };
    const accessToken = await this.jwtService.signAsync(payload);

    const refreshTokenRaw = crypto.randomBytes(48).toString('base64url');
    const refreshTokenHash = await bcrypt.hash(refreshTokenRaw, 10);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const refreshToken = await this.prismaService.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshTokenRaw: refreshTokenRaw,
      refreshToken: refreshToken,
      user,
    };
  }
}
