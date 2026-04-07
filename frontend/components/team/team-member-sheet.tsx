"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Loader2,
  Mail,
  RefreshCcw,
  ShieldCheck,
  UserMinus,
} from "lucide-react";
import * as React from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

import {
  TEAM_ROLE_BADGE_STYLES,
  TEAM_ROLE_OPTIONS,
} from "@/components/team/team-constants";
import { TeamLocationScopeField } from "@/components/team/team-location-scope-field";
import {
  formatRelativeActivity,
  getTeamApiErrorMessage,
  getUnavailableTeamLocationIds,
  mergeTeamLocationOptions,
} from "@/components/team/team-utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "@/hooks/use-toast";
import {
  formatDateTime,
  formatEnumLabel,
  formatShortDate,
  getInitials,
} from "@/lib/formatters";
import { TEAM_MEMBERSHIP_STATUS_STYLES } from "@/lib/status";
import {
  canAssignRole,
  canDeactivateMember,
  canEditMemberProfile,
  canManageMember,
} from "@/lib/team-access";
import type {
  TeamLocationOption,
  TeamMemberDetail,
  TeamRole,
  TeamRoleCard,
  UpdateTeamMemberInput,
} from "@/lib/team-types";

const memberProfileSchema = z.object({
  firstName: z.string().trim().optional(),
  lastName: z.string().trim().optional(),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
});

type MemberProfileFormValues = z.infer<typeof memberProfileSchema>;

type TeamMemberSheetProps = {
  open: boolean;
  member: TeamMemberDetail | null;
  loading: boolean;
  currentRole: string | null;
  currentUserId: string | null;
  availableLocations: TeamLocationOption[];
  roles: TeamRoleCard[];
  onClose: () => void;
  onSaveProfile: (
    member: TeamMemberDetail,
    values: UpdateTeamMemberInput,
  ) => Promise<void>;
  onSaveLocations: (
    member: TeamMemberDetail,
    locationIds: string[],
  ) => Promise<void>;
  onRequestRoleChange: (member: TeamMemberDetail, nextRole: TeamRole) => void;
  onRequestDeactivate: (member: TeamMemberDetail) => void;
  onResendInvite: (member: TeamMemberDetail) => Promise<void>;
  onReactivate: (member: TeamMemberDetail) => Promise<void>;
};

function getProfileDefaults(
  member: TeamMemberDetail | null,
): MemberProfileFormValues {
  return {
    firstName: member?.firstName ?? "",
    lastName: member?.lastName ?? "",
    email: member?.email ?? "",
  };
}

export function TeamMemberSheet({
  open,
  member,
  loading,
  currentRole,
  currentUserId,
  availableLocations,
  roles,
  onClose,
  onSaveProfile,
  onSaveLocations,
  onRequestRoleChange,
  onRequestDeactivate,
  onResendInvite,
  onReactivate,
}: TeamMemberSheetProps) {
  const [selectedRole, setSelectedRole] = React.useState<TeamRole>("CASHIER");
  const [selectedLocationIds, setSelectedLocationIds] = React.useState<
    string[]
  >([]);
  const [savingProfile, setSavingProfile] = React.useState(false);
  const [savingLocations, setSavingLocations] = React.useState(false);
  const [resendingInvite, setResendingInvite] = React.useState(false);
  const [reactivating, setReactivating] = React.useState(false);
  const [profileError, setProfileError] = React.useState<string | null>(null);
  const [locationError, setLocationError] = React.useState<string | null>(null);

  const form = useForm<MemberProfileFormValues>({
    resolver: zodResolver(memberProfileSchema),
    defaultValues: getProfileDefaults(member),
  });

  React.useEffect(() => {
    form.reset(getProfileDefaults(member));
    setSelectedRole(member?.role ?? "CASHIER");
    setSelectedLocationIds(
      member?.locations.map((location) => location.id) ?? [],
    );
    setProfileError(null);
    setLocationError(null);
  }, [form, member]);

  const isCurrentMember = member?.userId === currentUserId;
  const canEditCurrentProfile = member
    ? canEditMemberProfile(currentRole, currentUserId, member)
    : false;
  const canManageCurrentMember = member
    ? !isCurrentMember &&
      (canManageMember(currentRole, member.role) || currentRole === "OWNER")
    : false;
  const allowedRoleOptions = TEAM_ROLE_OPTIONS.filter((role) =>
    canAssignRole(currentRole, role),
  );
  const selectedRoleInfo = roles.find((role) => role.role === selectedRole);
  const mergedAvailableLocations = React.useMemo(
    () => mergeTeamLocationOptions(availableLocations, member?.locations ?? []),
    [availableLocations, member],
  );
  const unavailableLocationIds = React.useMemo(
    () => getUnavailableTeamLocationIds(mergedAvailableLocations),
    [mergedAvailableLocations],
  );

  async function handleSaveProfile(values: MemberProfileFormValues) {
    if (!member) {
      return;
    }

    setSavingProfile(true);
    setProfileError(null);

    try {
      await onSaveProfile(member, {
        firstName: values.firstName?.trim() || undefined,
        lastName: values.lastName?.trim() || undefined,
        email: values.email.trim(),
      });
      toast({
        title: "Profile updated",
        description: `${member.displayName}'s details were saved.`,
      });
    } catch (error) {
      setProfileError(
        getTeamApiErrorMessage(error, "Could not update profile"),
      );
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSaveLocations() {
    if (!member) {
      return;
    }

    setSavingLocations(true);
    setLocationError(null);

    try {
      await onSaveLocations(member, selectedLocationIds);
      toast({
        title: "Location scope updated",
        description: `${member.displayName}'s location access was saved.`,
      });
    } catch (error) {
      setLocationError(
        getTeamApiErrorMessage(error, "Could not update location access"),
      );
    } finally {
      setSavingLocations(false);
    }
  }

  async function handleResendInvite() {
    if (!member) {
      return;
    }

    setResendingInvite(true);

    try {
      await onResendInvite(member);
    } catch (error) {
      toast({
        title: "Could not resend invite",
        description: getTeamApiErrorMessage(error, "Try again in a moment."),
        variant: "destructive",
      });
    } finally {
      setResendingInvite(false);
    }
  }

  async function handleReactivate() {
    if (!member) {
      return;
    }

    setReactivating(true);

    try {
      await onReactivate(member);
    } catch (error) {
      toast({
        title: "Could not reactivate member",
        description: getTeamApiErrorMessage(error, "Try again in a moment."),
        variant: "destructive",
      });
    } finally {
      setReactivating(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-xl">
            {member?.displayName ?? "Member details"}
          </SheetTitle>
          <SheetDescription>
            Review access, update profile details, and manage role or location
            scope.
          </SheetDescription>
        </SheetHeader>

        {loading || !member ? (
          <div className="rounded-xl border p-4 text-sm text-muted-foreground">
            Loading member details...
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-xl border p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Avatar className="size-12">
                    <AvatarFallback
                      className={TEAM_ROLE_BADGE_STYLES[member.role]}
                    >
                      {getInitials(member.displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-lg font-semibold">
                      {member.displayName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {member.email}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge
                    className={TEAM_ROLE_BADGE_STYLES[member.role]}
                    variant="outline"
                  >
                    {formatEnumLabel(member.role)}
                  </Badge>
                  <Badge
                    className={TEAM_MEMBERSHIP_STATUS_STYLES[member.status]}
                    variant="outline"
                  >
                    {formatEnumLabel(member.status)}
                  </Badge>
                </div>
              </div>

              <div className="mt-4 grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
                <div>
                  <p className="font-medium text-foreground">Last active</p>
                  <p>{formatRelativeActivity(member.lastActiveAt)}</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">Member since</p>
                  <p>{formatShortDate(member.createdAt)}</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">Location access</p>
                  <p>
                    {member.hasAllLocations
                      ? "All locations"
                      : member.locations
                          .map((location) => location.name)
                          .join(", ")}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-foreground">Invite state</p>
                  <p>
                    {member.status === "INVITED" && member.inviteExpiresAt
                      ? `Expires ${formatDateTime(member.inviteExpiresAt)}`
                      : "Active membership"}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border p-4">
              <div className="mb-4">
                <h3 className="font-semibold">Profile</h3>
                <p className="text-sm text-muted-foreground">
                  Update the member&apos;s display information.
                </p>
              </div>

              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(handleSaveProfile)}
                  className="space-y-4"
                >
                  <div className="grid gap-3 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="First name"
                              disabled={!canEditCurrentProfile || savingProfile}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Last name"
                              disabled={!canEditCurrentProfile || savingProfile}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="person@example.com"
                              disabled={!canEditCurrentProfile || savingProfile}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {profileError ? (
                    <p className="text-sm text-destructive">{profileError}</p>
                  ) : null}

                  <Button
                    type="submit"
                    size="sm"
                    variant="outline"
                    disabled={!canEditCurrentProfile || savingProfile}
                  >
                    {savingProfile && (
                      <Loader2 className="mr-1.5 size-4 animate-spin" />
                    )}
                    Save
                  </Button>
                </form>
              </Form>
            </div>

            <div className="rounded-xl border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold">Role</h3>
                  <p className="text-sm text-muted-foreground">
                    Role permissions are code-defined and read-only.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={
                    !member ||
                    !canAssignRole(currentRole, selectedRole) ||
                    member.userId === currentUserId ||
                    member.role === selectedRole
                  }
                  onClick={() => onRequestRoleChange(member, selectedRole)}
                >
                  Change role
                </Button>
              </div>

              <div className="mt-4 grid gap-4">
                <Select
                  value={selectedRole}
                  onValueChange={(value) => setSelectedRole(value as TeamRole)}
                  disabled={!canManageCurrentMember}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedRoleOptions.map((role) => (
                      <SelectItem key={role} value={role}>
                        {formatEnumLabel(role)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedRoleInfo ? (
                  <div className="rounded-xl border bg-muted/40 p-4">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="size-4 text-muted-foreground" />
                      <p className="text-sm font-medium">Permission summary</p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge
                        className={
                          TEAM_ROLE_BADGE_STYLES[selectedRoleInfo.role]
                        }
                        variant="outline"
                      >
                        {formatEnumLabel(selectedRoleInfo.role)}
                      </Badge>
                      {selectedRoleInfo.permissions.map((permission) => (
                        <Badge key={permission} variant="outline">
                          {permission === "*" ? "Wildcard access" : permission}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-xl border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold">Location access</h3>
                  <p className="text-sm text-muted-foreground">
                    Leave all unchecked to keep this member on all accessible
                    locations.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!canManageCurrentMember || savingLocations}
                  onClick={() => void handleSaveLocations()}
                >
                  {savingLocations && (
                    <Loader2 className="mr-1.5 size-4 animate-spin" />
                  )}
                  Save scope
                </Button>
              </div>

              <div className="mt-4">
                <TeamLocationScopeField
                  label="Assigned locations"
                  description="Leave every location unchecked to grant access across all current locations."
                  availableLocations={mergedAvailableLocations}
                  selectedLocationIds={selectedLocationIds}
                  unavailableLocationIds={unavailableLocationIds}
                  disabled={!canManageCurrentMember || savingLocations}
                  onChange={setSelectedLocationIds}
                />
              </div>

              {locationError ? (
                <p className="mt-4 text-sm text-destructive">{locationError}</p>
              ) : null}
            </div>

            <div className="rounded-xl border p-4">
              <h3 className="font-semibold">Activity</h3>
              <div className="mt-4 space-y-3">
                {member.activity.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No recent activity recorded for this member yet.
                  </p>
                ) : (
                  member.activity.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start justify-between gap-3"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {formatEnumLabel(activity.action)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {activity.actor
                            ? `${activity.actor.firstName ?? ""} ${activity.actor.lastName ?? ""}`.trim() ||
                              activity.actor.email
                            : "System"}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(activity.createdAt)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-t pt-2">
              {member.status === "INVITED" ? (
                <Button
                  variant="outline"
                  onClick={() => void handleResendInvite()}
                  disabled={resendingInvite}
                >
                  {resendingInvite ? (
                    <Loader2 className="mr-1.5 size-4 animate-spin" />
                  ) : (
                    <Mail className="mr-1.5 size-4" />
                  )}
                  Resend invite
                </Button>
              ) : null}
              {member.status === "DEACTIVATED" ? (
                <Button
                  variant="outline"
                  onClick={() => void handleReactivate()}
                  disabled={reactivating}
                >
                  {reactivating ? (
                    <Loader2 className="mr-1.5 size-4 animate-spin" />
                  ) : (
                    <RefreshCcw className="mr-1.5 size-4" />
                  )}
                  Reactivate
                </Button>
              ) : null}
              {canDeactivateMember(currentRole, currentUserId, member) ? (
                <Button
                  variant="destructive"
                  onClick={() => onRequestDeactivate(member)}
                >
                  <UserMinus className="mr-1.5 size-4" />
                  Deactivate
                </Button>
              ) : null}
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
