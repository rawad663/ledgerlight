import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { type CurrentOrg } from '@src/common/decorators/current-org.decorator';
import { Role } from '@prisma/generated/enums';

type OrganizationIdentifier = { organizationId: string };

export type OrganizationScope = CurrentOrg | OrganizationIdentifier | string;

export function hasResolvedLocationScope(
  org: OrganizationScope,
): org is CurrentOrg {
  return (
    typeof org !== 'string' &&
    ('membershipId' in org ||
      'hasAllLocations' in org ||
      'allowedLocationIds' in org)
  );
}

export function toOrganizationScopeInput(
  org: OrganizationScope,
): CurrentOrg | string {
  if (typeof org === 'string') {
    return org;
  }

  if (hasResolvedLocationScope(org)) {
    return org;
  }

  return org.organizationId;
}

export function resolveOrganizationScope(org: OrganizationScope): CurrentOrg {
  if (typeof org === 'string') {
    return {
      membershipId: '',
      organizationId: org,
      role: Role.OWNER,
      hasAllLocations: true,
      allowedLocationIds: [],
    };
  }

  if (!hasResolvedLocationScope(org)) {
    return {
      membershipId: '',
      organizationId: org.organizationId,
      role: Role.OWNER,
      hasAllLocations: true,
      allowedLocationIds: [],
    };
  }

  return {
    ...org,
    hasAllLocations: org.hasAllLocations ?? true,
    allowedLocationIds: org.allowedLocationIds ?? [],
  };
}

export function hasRestrictedLocations(org: OrganizationScope): boolean {
  const resolvedOrg = resolveOrganizationScope(org);
  return !resolvedOrg.hasAllLocations;
}

export function ensureLocationAccessible(
  org: OrganizationScope,
  locationId: string | null | undefined,
  options?: {
    allowUnspecified?: boolean;
    missingMessage?: string;
    forbiddenMessage?: string;
  },
) {
  const resolvedOrg = resolveOrganizationScope(org);

  if (!locationId) {
    if (
      (options?.allowUnspecified ?? true) ||
      resolvedOrg.allowedLocationIds.length === 0
    ) {
      return;
    }

    throw new BadRequestException(
      options?.missingMessage ?? 'A location is required for this membership',
    );
  }

  if (resolvedOrg.hasAllLocations) {
    return;
  }

  if (!resolvedOrg.allowedLocationIds.includes(locationId)) {
    throw new ForbiddenException(
      options?.forbiddenMessage ??
        'You do not have access to the selected location',
    );
  }
}

export function getLocationScopeWhere(
  org: OrganizationScope,
  fieldName: string = 'locationId',
) {
  const resolvedOrg = resolveOrganizationScope(org);

  if (resolvedOrg.hasAllLocations) {
    return {};
  }

  return {
    [fieldName]: {
      in: resolvedOrg.allowedLocationIds,
    },
  };
}

export function getLocationScopeList(
  org: OrganizationScope,
): string[] | undefined {
  const resolvedOrg = resolveOrganizationScope(org);

  return resolvedOrg.hasAllLocations
    ? undefined
    : resolvedOrg.allowedLocationIds;
}
