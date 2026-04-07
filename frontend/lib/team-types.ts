import type { components } from "@/lib/api-types";

export type TeamRole = components["schemas"]["TeamRoleDto"]["role"];
export type MembershipStatus = components["schemas"]["TeamMemberListItemDto"]["status"];

export type TeamLocationStatus =
  components["schemas"]["LocationListItemDto"]["status"];
export type TeamLocation = components["schemas"]["TeamLocationDto"];
export type TeamLocationOption = TeamLocation & {
  status?: TeamLocationStatus;
};
export type TeamMemberStats = components["schemas"]["TeamMemberStatsDto"];
export type TeamMemberListItem = components["schemas"]["TeamMemberListItemDto"];
export type TeamActivityItem = Omit<
  components["schemas"]["TeamActivityItemDto"],
  "actor" | "beforeJson" | "afterJson"
> & {
  actor?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
  } | null;
  beforeJson?: unknown;
  afterJson?: unknown;
};
export type TeamMemberDetail = Omit<
  components["schemas"]["TeamMemberDetailDto"],
  "activity"
> & {
  activity: TeamActivityItem[];
};
export type TeamMembersResponse = components["schemas"]["TeamMembersResponseDto"];
export type TeamRoleCard = components["schemas"]["TeamRoleDto"];
export type TeamRolesResponse = components["schemas"]["TeamRolesResponseDto"];
export type TeamMutationResponse = Omit<
  components["schemas"]["TeamMutationResponseDto"],
  "member"
> & {
  member: TeamMemberDetail;
};
export type InvitationResolution = Omit<
  components["schemas"]["InvitationResolutionDto"],
  "member"
> & {
  member?: TeamMemberDetail;
};
export type InviteResolutionStatus = InvitationResolution["status"];
export type AcceptInvitationResponse = Omit<
  components["schemas"]["AcceptInviteResponseDto"],
  "member"
> & {
  member: TeamMemberDetail;
};
export type InviteMemberInput = components["schemas"]["InviteMemberDto"];
export type UpdateTeamMemberInput = components["schemas"]["UpdateTeamMemberDto"];
export type UpdateTeamMemberRoleInput = components["schemas"]["UpdateTeamMemberRoleDto"];
export type UpdateTeamMemberLocationsInput =
  components["schemas"]["UpdateTeamMemberLocationsDto"];
