import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { User, Membership, Role } from '@prisma/generated/client';
import { Request } from 'express';

export type JwtMembership = Pick<
  Membership,
  'id' | 'userId' | 'organizationId' | 'role'
>;

export type UserWithMemberships = Omit<User, 'passwordHash'> & {
  memberships: JwtMembership[];
};

export type JwtPayload = {
  sub: string; // userId
  user: Omit<User, 'passwordHash'>;
  memberships: JwtMembership[];
};

export interface RequestWithUser extends Request {
  user: UserWithMemberships;
  organization?: {
    organizationId: string;
    role: Role;
  };
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
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

  validate(payload: JwtPayload) {
    if (!payload?.sub) throw new UnauthorizedException('Invalid token payload');

    return {
      ...payload.user,
      memberships: payload.memberships,
    };
  }
}
