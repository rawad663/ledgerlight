import { NextRequest, NextResponse } from "next/server";

import { AUTH_COOKIE_MAP } from "@/lib/api-config";
import { shouldUseSecureCookies } from "@/lib/auth-cookie";
import { buildCorrelationHeaders } from "@/lib/server-observability";

async function readJson(response: Response) {
  return response.json().catch(() => null);
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const { headers } = buildCorrelationHeaders(request.headers, {
    "Content-Type": request.headers.get("content-type") ?? "application/json",
  });
  const upstreamResponse = await fetch(
    new URL("/auth/login", process.env.NEXT_PUBLIC_API_URL!).toString(),
    {
      method: "POST",
      headers,
      body: rawBody,
      cache: "no-store",
    },
  );

  const data = await readJson(upstreamResponse);
  if (!upstreamResponse.ok) {
    return NextResponse.json(data ?? { message: "Login failed" }, {
      status: upstreamResponse.status,
    });
  }

  if (
    !data ||
    typeof data !== "object" ||
    !("accessToken" in data) ||
    !("refreshTokenRaw" in data) ||
    !("user" in data) ||
    !("memberships" in data) ||
    !data.accessToken ||
    !data.refreshTokenRaw ||
    !data.user ||
    typeof data.user !== "object" ||
    !("id" in data.user) ||
    !data.user.id ||
    !Array.isArray(data.memberships) ||
    !data.memberships.length
  ) {
    return NextResponse.json(
      { message: "Invalid login response" },
      { status: 502 },
    );
  }

  const useSecureCookies = shouldUseSecureCookies(request.nextUrl);
  const response = NextResponse.json({
    user: data.user,
    memberships: data.memberships,
  });

  const { ACCESS_TOKEN, REFRESH_TOKEN, USER_ID, X_ORGANIZATION_ID } =
    AUTH_COOKIE_MAP;

  // Access token: non-httpOnly so client JS can read it for Authorization header
  response.cookies.set(ACCESS_TOKEN, data.accessToken, {
    httpOnly: false,
    secure: useSecureCookies,
    sameSite: "lax",
    path: "/",
    maxAge: 15 * 60,
  });

  // Refresh token: httpOnly to protect from XSS
  response.cookies.set(REFRESH_TOKEN, data.refreshTokenRaw, {
    httpOnly: true,
    secure: useSecureCookies,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });

  // User ID: httpOnly — only middleware needs it for refresh
  response.cookies.set(USER_ID, data.user.id as string, {
    httpOnly: true,
    secure: useSecureCookies,
    sameSite: "lax",
    path: "/",
  });

  // Organization ID: non-httpOnly — client reads it for X-Organization-Id header
  const primaryMembership = data.memberships[0];
  if (
    primaryMembership &&
    typeof primaryMembership === "object" &&
    "organizationId" in primaryMembership &&
    typeof primaryMembership.organizationId === "string"
  ) {
    response.cookies.set(X_ORGANIZATION_ID, primaryMembership.organizationId, {
      httpOnly: false,
      secure: useSecureCookies,
      sameSite: "lax",
      path: "/",
    });
  }

  return response;
}
