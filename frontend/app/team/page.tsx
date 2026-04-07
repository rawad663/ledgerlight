import { AppShell } from "@/components/app-shell";
import {
  TEAM_ROLE_OPTIONS,
  TEAM_STATUS_OPTIONS,
} from "@/components/team/team-constants";
import { TeamPage } from "@/components/team/team-page";
import { createApi } from "@/lib/api";
import { getServerCurrentRole } from "@/lib/server-auth";
import { canAccessTeam } from "@/lib/team-access";
import type {
  TeamLocationOption,
  TeamMembersResponse,
  TeamRoleCard,
  TeamRolesResponse,
} from "@/lib/team-types";

const EMPTY_TEAM_MEMBERS: TeamMembersResponse = {
  data: [],
  stats: {
    activeMembers: 0,
    pendingInvites: 0,
    deactivatedMembers: 0,
  },
  totalCount: 0,
};

export default async function Team({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; role?: string }>;
}) {
  const { search, status, role } = await searchParams;
  const normalizedStatus = TEAM_STATUS_OPTIONS.includes(
    status as TeamMembersResponse["data"][number]["status"],
  )
    ? (status as TeamMembersResponse["data"][number]["status"])
    : undefined;
  const normalizedRole = TEAM_ROLE_OPTIONS.includes(
    role as TeamRolesResponse["data"][number]["role"],
  )
    ? (role as TeamRolesResponse["data"][number]["role"])
    : undefined;
  const initialCurrentRole = await getServerCurrentRole();
  const initialCanAccess = canAccessTeam(initialCurrentRole);

  let initialMembers = EMPTY_TEAM_MEMBERS;
  let initialRoles: TeamRoleCard[] = [];
  let initialLocations: TeamLocationOption[] = [];

  if (initialCanAccess) {
    const api = await createApi();
    const [{ data: locationData }, membersResponse, rolesResponse] =
      await Promise.all([
        api.GET("/locations", {
          params: {
            query: {
              limit: 100,
            },
          },
        }),
        api.GET("/team", {
          params: {
            query: {
              limit: 50,
              search,
              status: normalizedStatus,
              role: normalizedRole,
              sortBy: "updatedAt",
              sortOrder: "desc",
            },
          },
        }),
        api.GET("/team/roles"),
      ]);

    if (membersResponse.error) {
      console.error(membersResponse.error);
    }

    if (rolesResponse.error) {
      console.error(rolesResponse.error);
    }

    initialMembers = membersResponse.data ?? EMPTY_TEAM_MEMBERS;
    initialRoles = rolesResponse.data?.data ?? [];
    initialLocations =
      locationData?.data.map((location) => ({
        id: location.id,
        name: location.name,
        status: location.status,
      })) ?? [];
  }

  return (
    <AppShell>
      <TeamPage
        initialMembers={initialMembers}
        initialRoles={initialRoles}
        initialLocations={initialLocations}
        initialCurrentRole={initialCurrentRole}
        initialSearch={search ?? ""}
        initialStatus={status ?? "all"}
        initialRole={role ?? "all"}
      />
    </AppShell>
  );
}
