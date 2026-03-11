import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/generated/enums';

export const ROLES_KEY = 'roles';

/**
 * Sets required roles metadata.
 * Prefer using @Authorized(...roles) which also applies the necessary guards.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
