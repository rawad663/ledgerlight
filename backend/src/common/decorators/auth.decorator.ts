import { applyDecorators, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/generated/enums';
import {
  JwtAuthGuard,
  OrganizationContextGuard,
  RolesGuard,
} from '@src/common/guards';
import { Roles } from './roles.decorator';

/**
 * Use for endpoints that only require a valid JWT.
 */
export const Authenticated = () => applyDecorators(UseGuards(JwtAuthGuard));

/**
 * Use for endpoints that require an active organization context.
 * Implies JWT authentication.
 */
export const OrgProtected = () =>
  applyDecorators(UseGuards(JwtAuthGuard, OrganizationContextGuard));

/**
 * Use for endpoints that require specific roles within the active organization.
 * Implies JWT and organization context.
 */
export const Authorized = (...roles: Role[]) =>
  applyDecorators(
    UseGuards(JwtAuthGuard, OrganizationContextGuard, RolesGuard),
    Roles(...roles),
  );
