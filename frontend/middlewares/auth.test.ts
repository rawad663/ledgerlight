import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_COOKIE_MAP } from "@/lib/api-config";
import { authMiddleware } from "@/middlewares/auth";

function createJwt(expOffsetSeconds: number): string {
  const payload = {
    exp: Math.floor(Date.now() / 1000) + expOffsetSeconds,
  };

  const encodedPayload = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  return `header.${encodedPayload}.signature`;
}

function createRequest(
  pathname: string,
  cookieValues?: Record<string, string>,
) {
  const cookieHeader = cookieValues
    ? Object.entries(cookieValues)
        .map(([key, value]) => `${key}=${value}`)
        .join("; ")
    : "";

  return new NextRequest(`http://localhost${pathname}`, {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
}

describe("authMiddleware", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = "http://api.test";
    vi.unstubAllGlobals();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("allows anonymous users onto /login", async () => {
    const response = await authMiddleware(createRequest("/login"));

    expect(response?.status).toBe(200);
    expect(response?.headers.get("location")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("redirects authenticated users away from /login", async () => {
    const response = await authMiddleware(
      createRequest("/login", {
        [AUTH_COOKIE_MAP.ACCESS_TOKEN]: createJwt(15 * 60),
      }),
    );

    expect(response?.status).toBe(307);
    expect(response?.headers.get("location")).toBe("http://localhost/");
  });

  it("allows anonymous users onto invite routes", async () => {
    const response = await authMiddleware(createRequest("/invite/test-token"));

    expect(response?.status).toBe(200);
    expect(response?.headers.get("location")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("allows authenticated users onto invite routes without redirecting", async () => {
    const response = await authMiddleware(
      createRequest("/invite/test-token", {
        [AUTH_COOKIE_MAP.ACCESS_TOKEN]: createJwt(15 * 60),
        [AUTH_COOKIE_MAP.REFRESH_TOKEN]: "refresh-token",
        [AUTH_COOKIE_MAP.USER_ID]: "user-1",
      }),
    );

    expect(response?.status).toBe(200);
    expect(response?.headers.get("location")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("redirects anonymous users on private routes to login with returnTo", async () => {
    const response = await authMiddleware(createRequest("/orders"));

    expect(response?.status).toBe(307);
    expect(response?.headers.get("location")).toBe(
      "http://localhost/login?returnTo=%2Forders",
    );
  });

  it("refreshes expired access tokens on private routes when refresh cookies exist", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ accessToken: "fresh-access-token" }),
    } as Response);

    const response = await authMiddleware(
      createRequest("/orders", {
        [AUTH_COOKIE_MAP.ACCESS_TOKEN]: createJwt(-120),
        [AUTH_COOKIE_MAP.REFRESH_TOKEN]: "refresh-token",
        [AUTH_COOKIE_MAP.USER_ID]: "user-1",
      }),
    );

    expect(fetch).toHaveBeenCalledWith(
      "http://api.test/auth/refresh",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(response?.status).toBe(200);
    expect(response?.cookies.get(AUTH_COOKIE_MAP.ACCESS_TOKEN)?.value).toBe(
      "fresh-access-token",
    );
  });

  it("clears cookies and redirects when refresh fails on a private route", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
    } as Response);

    const response = await authMiddleware(
      createRequest("/orders", {
        [AUTH_COOKIE_MAP.ACCESS_TOKEN]: createJwt(-120),
        [AUTH_COOKIE_MAP.REFRESH_TOKEN]: "refresh-token",
        [AUTH_COOKIE_MAP.USER_ID]: "user-1",
      }),
    );

    expect(response?.status).toBe(307);
    expect(response?.headers.get("location")).toBe(
      "http://localhost/login?returnTo=%2Forders",
    );
    const setCookieHeader = response?.headers.get("set-cookie") ?? "";
    expect(setCookieHeader).toContain(`${AUTH_COOKIE_MAP.ACCESS_TOKEN}=;`);
    expect(setCookieHeader).toContain(`${AUTH_COOKIE_MAP.REFRESH_TOKEN}=;`);
    expect(setCookieHeader).toContain(`${AUTH_COOKIE_MAP.USER_ID}=;`);
  });

  it("ignores unlisted routes instead of treating them as private by default", async () => {
    const response = await authMiddleware(createRequest("/unknown"));

    expect(response?.status).toBe(200);
    expect(response?.headers.get("location")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
