import { applyDecorators, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiResponse,
} from '@nestjs/swagger';
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
export const Authenticated = () =>
  applyDecorators(
    UseGuards(JwtAuthGuard),
    ApiBearerAuth(),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
  );

/**
 * Use for endpoints that require an active organization context.
 * Implies JWT authentication.
 */
export const OrgProtected = () =>
  applyDecorators(
    UseGuards(JwtAuthGuard, OrganizationContextGuard),
    ApiBearerAuth(),
    ApiHeader({
      name: 'X-Organization-Id',
      description:
        'Active organization context for the request. Must be an organization the user is a member of.',
      required: true,
    }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiForbiddenResponse({
      description: 'Forbidden (invalid/missing organization context)',
    }),
  );

/**
 * Use for endpoints that require specific roles within the active organization.
 * Implies JWT and organization context.
 */
export const Authorized = (...roles: Role[]) =>
  applyDecorators(
    UseGuards(JwtAuthGuard, OrganizationContextGuard, RolesGuard),
    Roles(...roles),
  );

/** Doc-only: adds org header + common auth responses without guards */
export const OrgContextDocs = () =>
  applyDecorators(
    ApiHeader({
      name: 'X-Organization-Id',
      description:
        'Active organization context for the request. Must be an organization the user is a member of.',
      required: true,
    }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiForbiddenResponse({
      description: 'Forbidden (invalid/missing organization context)',
    }),
  );
