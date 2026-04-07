import type { MembershipStatus, TeamRole } from "@/lib/team-types";

export const TEAM_ACCESS_ROLES: TeamRole[] = ["OWNER", "MANAGER"];

export const ROLE_TIER: Record<TeamRole, number> = {
  OWNER: 1,
  MANAGER: 2,
  CASHIER: 3,
  SUPPORT: 3,
  INVENTORY_CLERK: 3,
};

export function canAccessTeam(role: string | null | undefined): boolean {
  return role ? TEAM_ACCESS_ROLES.includes(role as TeamRole) : false;
}

export function canAssignRole(
  actorRole: string | null | undefined,
  targetRole: TeamRole,
): boolean {
  if (!actorRole) {
    return false;
  }

  if (actorRole === "OWNER") {
    return true;
  }

  return ROLE_TIER[actorRole as TeamRole] < ROLE_TIER[targetRole];
}

export function canManageMember(
  actorRole: string | null | undefined,
  targetRole: TeamRole,
): boolean {
  if (!actorRole) {
    return false;
  }

  if (actorRole === "OWNER") {
    return targetRole !== "OWNER";
  }

  return ROLE_TIER[actorRole as TeamRole] < ROLE_TIER[targetRole];
}

export function canEditMemberProfile(
  actorRole: string | null | undefined,
  actorUserId: string | null | undefined,
  target: {
    role: TeamRole;
    userId: string;
  },
): boolean {
  if (!actorRole) {
    return false;
  }

  if (actorUserId && target.userId === actorUserId) {
    return true;
  }

  if (actorRole === "OWNER") {
    return true;
  }

  return ROLE_TIER[actorRole as TeamRole] < ROLE_TIER[target.role];
}

export function canDeactivateMember(
  actorRole: string | null | undefined,
  actorUserId: string | null | undefined,
  target: {
    role: TeamRole;
    userId: string;
    status: MembershipStatus;
  },
): boolean {
  if (!actorRole || target.status === "DEACTIVATED") {
    return false;
  }

  if (actorUserId && target.userId === actorUserId) {
    return false;
  }

  if (actorRole === "OWNER") {
    return true;
  }

  return ROLE_TIER[actorRole as TeamRole] < ROLE_TIER[target.role];
}
