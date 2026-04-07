import { describe, expect, it } from "vitest";

import {
  isPrivateRoute,
  isPublicRoute,
  PRIVATE_ROUTES,
  PUBLIC_ROUTES,
} from "@/lib/route-access";

describe("route-access", () => {
  it("exports the expected route registries", () => {
    expect(PRIVATE_ROUTES).toContain("/");
    expect(PRIVATE_ROUTES).toContain("/orders");
    expect(PRIVATE_ROUTES).toContain("/team");
    expect(PUBLIC_ROUTES).toEqual(["/login", "/invite"]);
  });

  it("matches exact and nested private routes", () => {
    expect(isPrivateRoute("/")).toBe(true);
    expect(isPrivateRoute("/orders")).toBe(true);
    expect(isPrivateRoute("/orders/ord-123")).toBe(true);
    expect(isPrivateRoute("/team")).toBe(true);
    expect(isPrivateRoute("/team/member-1")).toBe(true);
  });

  it("matches exact and nested public routes", () => {
    expect(isPublicRoute("/login")).toBe(true);
    expect(isPublicRoute("/invite")).toBe(true);
    expect(isPublicRoute("/invite/test-token")).toBe(true);
  });

  it("avoids false positives for unrelated lookalike paths", () => {
    expect(isPublicRoute("/inventory")).toBe(false);
    expect(isPublicRoute("/invites")).toBe(false);
    expect(isPrivateRoute("/login")).toBe(false);
    expect(isPrivateRoute("/invite/test-token")).toBe(false);
    expect(isPrivateRoute("/unknown")).toBe(false);
  });
});
