import { NextRequest, NextResponse } from "next/server";

import { AUTH_COOKIE_MAP } from "@/lib/api-config";

export async function POST(request: NextRequest) {
  const accessToken = request.cookies.get(AUTH_COOKIE_MAP.ACCESS_TOKEN)?.value;
  const organizationId = request.cookies.get(
    AUTH_COOKIE_MAP.X_ORGANIZATION_ID,
  )?.value;

  const upstreamResponse = await fetch(
    new URL("/auth/logout", process.env.NEXT_PUBLIC_API_URL!).toString(),
    {
      method: "POST",
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(organizationId
          ? { "X-Organization-Id": organizationId }
          : {}),
      },
      cache: "no-store",
    },
  );

  const response = NextResponse.json(
    upstreamResponse.ok
      ? { success: true }
      : {
          error:
            (await upstreamResponse.json().catch(() => null))?.message ??
            "Logout failed",
        },
    { status: upstreamResponse.ok ? 200 : upstreamResponse.status },
  );

  // Always clear auth cookies, regardless of backend response
  // The idea is: the user intends to logout regardless if the backend acknowledged it.
  const authCookieKeys = Object.keys(
    AUTH_COOKIE_MAP,
  ) as (keyof typeof AUTH_COOKIE_MAP)[];

  for (const key of authCookieKeys) {
    response.cookies.delete(AUTH_COOKIE_MAP[key]);
  }

  return response;
}
