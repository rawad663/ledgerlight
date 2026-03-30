import { NextRequest, NextResponse } from "next/server";

import { createApi } from "@/lib/api";
import { ApiError, AUTH_COOKIE_MAP } from "@/lib/api-config";

export async function POST(request: NextRequest) {
  const api = await createApi(false);

  const body = await request.json();

  const { data, error } = await api.POST("/auth/login", { body });

  if (error) {
    return NextResponse.json(error, { status: (error as ApiError).statusCode });
  }

  if (
    !data?.accessToken ||
    !data.refreshTokenRaw ||
    !data.user?.id ||
    !data.memberships?.length
  ) {
    return NextResponse.json(
      { message: "Invalid login response" },
      { status: 502 },
    );
  }

  const isProduction = process.env.NODE_ENV === "production";
  const response = NextResponse.json({
    user: data.user,
    memberships: data.memberships,
  });

  const { ACCESS_TOKEN, REFRESH_TOKEN, USER_ID, X_ORGANIZATION_ID } =
    AUTH_COOKIE_MAP;

  // Access token: non-httpOnly so client JS can read it for Authorization header
  response.cookies.set(ACCESS_TOKEN, data.accessToken, {
    httpOnly: false,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 15 * 60,
  });

  // Refresh token: httpOnly to protect from XSS
  response.cookies.set(REFRESH_TOKEN, data.refreshTokenRaw, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });

  // User ID: httpOnly — only middleware needs it for refresh
  response.cookies.set(USER_ID, data.user.id, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
  });

  // Organization ID: non-httpOnly — client reads it for X-Organization-Id header
  response.cookies.set(X_ORGANIZATION_ID, data.memberships[0].organizationId, {
    httpOnly: false,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
  });

  return response;
}
