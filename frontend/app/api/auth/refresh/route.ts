import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { AUTH_COOKIE_MAP } from "@/lib/api-config";
import { shouldUseSecureCookies } from "@/lib/auth-cookie";

async function readJson(response: Response) {
  return response.json().catch(() => null);
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const refreshTokenRaw = cookieStore.get(AUTH_COOKIE_MAP.REFRESH_TOKEN)?.value;
  const userId = cookieStore.get(AUTH_COOKIE_MAP.USER_ID)?.value;

  if (!refreshTokenRaw || !userId) {
    return NextResponse.json(
      { message: "Missing refresh credentials" },
      { status: 401 },
    );
  }

  const upstreamResponse = await fetch(
    new URL("/auth/refresh", process.env.NEXT_PUBLIC_API_URL!).toString(),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshTokenRaw, userId }),
      cache: "no-store",
    },
  );
  const data = await readJson(upstreamResponse);

  if (
    !upstreamResponse.ok ||
    !data ||
    typeof data !== "object" ||
    !("accessToken" in data) ||
    !data.accessToken
  ) {
    return NextResponse.json(
      data ?? { message: "Invalid refresh response" },
      {
        status: upstreamResponse.ok ? 502 : upstreamResponse.status,
      },
    );
  }

  const response = NextResponse.json({
    accessToken: data.accessToken,
    user:
      "user" in data && data.user && typeof data.user === "object"
        ? data.user
        : null,
  });

  response.cookies.set(AUTH_COOKIE_MAP.ACCESS_TOKEN, data.accessToken, {
    httpOnly: false,
    secure: shouldUseSecureCookies(request.nextUrl),
    sameSite: "lax",
    path: "/",
    maxAge: 15 * 60,
  });

  return response;
}
