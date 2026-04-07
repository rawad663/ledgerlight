import { describe, expect, it } from "vitest";

import {
  canAccessTeam,
  canAssignRole,
  canDeactivateMember,
  canEditMemberProfile,
  canManageMember,
  ROLE_TIER,
} from "@/lib/team-access";

describe("team-access helpers", () => {
  it("limits team navigation to owners and managers", () => {
    expect(canAccessTeam("OWNER")).toBe(true);
    expect(canAccessTeam("MANAGER")).toBe(true);
    expect(canAccessTeam("SUPPORT")).toBe(false);
    expect(canAccessTeam(null)).toBe(false);
  });

  it("enforces tier-based role assignment and management", () => {
    expect(ROLE_TIER.OWNER).toBeLessThan(ROLE_TIER.MANAGER);
    expect(canAssignRole("OWNER", "OWNER")).toBe(true);
    expect(canAssignRole("MANAGER", "CASHIER")).toBe(true);
    expect(canAssignRole("MANAGER", "MANAGER")).toBe(false);
    expect(canManageMember("OWNER", "OWNER")).toBe(false);
    expect(canManageMember("MANAGER", "SUPPORT")).toBe(true);
    expect(canManageMember("MANAGER", "OWNER")).toBe(false);
  });

  it("allows self profile edits without granting broader member management", () => {
    expect(
      canEditMemberProfile("MANAGER", "user-1", {
        role: "MANAGER",
        userId: "user-1",
      }),
    ).toBe(true);

    expect(
      canEditMemberProfile("MANAGER", "user-1", {
        role: "OWNER",
        userId: "user-2",
      }),
    ).toBe(false);
  });

  it("prevents self-deactivation and deactivated-member actions", () => {
    expect(
      canDeactivateMember("OWNER", "user-1", {
        role: "MANAGER",
        userId: "user-1",
        status: "ACTIVE",
      }),
    ).toBe(false);

    expect(
      canDeactivateMember("MANAGER", "user-1", {
        role: "SUPPORT",
        userId: "user-2",
        status: "DEACTIVATED",
      }),
    ).toBe(false);

    expect(
      canDeactivateMember("MANAGER", "user-1", {
        role: "SUPPORT",
        userId: "user-2",
        status: "ACTIVE",
      }),
    ).toBe(true);
  });
});
