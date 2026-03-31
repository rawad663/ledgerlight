import { SetMetadata } from '@nestjs/common';
import { type Permission } from '@src/common/permissions';

/** All listed permissions must be present (AND semantics). */
export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/** At least one listed permission must be present (OR semantics).
 *  Use for endpoints where different roles may access via different capabilities,
 *  e.g. POST /orders/:id/transition-status where the fine-grained check happens
 *  inside the controller body. */
export const PERMISSIONS_ANY_KEY = 'permissions_any';
export const RequireAnyPermission = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_ANY_KEY, permissions);
