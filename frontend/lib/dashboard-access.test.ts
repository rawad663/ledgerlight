import { describe, expect, it } from "vitest";

import { canAccessDashboard } from "@/lib/dashboard-access";

describe("canAccessDashboard", () => {
  it("allows owner and manager roles", () => {
    expect(canAccessDashboard("OWNER")).toBe(true);
    expect(canAccessDashboard("MANAGER")).toBe(true);
  });

  it("rejects all other or missing roles", () => {
    expect(canAccessDashboard("SUPPORT")).toBe(false);
    expect(canAccessDashboard("CASHIER")).toBe(false);
    expect(canAccessDashboard(null)).toBe(false);
  });
});
