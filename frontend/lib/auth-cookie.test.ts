import { describe, expect, it } from "vitest";

import { shouldUseSecureCookies } from "./auth-cookie";

describe("shouldUseSecureCookies", () => {
  it("returns false for local http URLs", () => {
    expect(shouldUseSecureCookies(new URL("http://127.0.0.1:3005/login"))).toBe(
      false,
    );
  });

  it("returns true for https URLs", () => {
    expect(
      shouldUseSecureCookies(new URL("https://admin.ledgerlight.example/orders")),
    ).toBe(true);
  });
});
