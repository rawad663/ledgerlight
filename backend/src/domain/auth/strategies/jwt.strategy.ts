import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { User, Membership } from '@prisma/generated/client';
import { Request } from 'express';
import { PrismaService } from '@src/infra/prisma/prisma.service';

export type UserWithMemberships = Omit<User, 'passwordHash'> & {
  memberships: Membership[];
};

export type JwtPayload = {
  sub: string; // userId
  user: Omit<User, 'passwordHash'>;
};

export interface RequestWithUser extends Request {
  user: UserWithMemberships;
  organization?: {
    organizationId: string;
    role: string;
  };
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly prismaService: PrismaService) {
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) {
      throw new Error('JWT_ACCESS_SECRET environment variable is not set');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    // This return value becomes req.user
    if (!payload?.sub) throw new UnauthorizedException('Invalid token payload');

    const memberships = await this.prismaService.membership.findMany({
      where: { userId: payload.sub },
    });

    return {
      ...payload.user,
      memberships,
    };
  }
}
