import { applyDecorators, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiResponse,
} from '@nestjs/swagger';
import {
  JwtAuthGuard,
  OrganizationContextGuard,
  PermissionsGuard,
} from '@src/common/guards';

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
 * Implies JWT authentication and permission enforcement.
 */
export const OrgProtected = () =>
  applyDecorators(
    UseGuards(JwtAuthGuard, OrganizationContextGuard, PermissionsGuard),
    ApiBearerAuth(),
    ApiHeader({
      name: 'X-Organization-Id',
      description:
        'Active organization context for the request. Must be an organization the user is a member of.',
      required: true,
    }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiForbiddenResponse({
      description:
        'Forbidden (invalid/missing organization context or insufficient permissions)',
    }),
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
