import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { createApi } from "@/lib/api";
import { ApiError, AUTH_COOKIE_MAP } from "@/lib/api-config";

export async function POST() {
  const cookieStore = await cookies();
  const refreshTokenRaw = cookieStore.get(AUTH_COOKIE_MAP.REFRESH_TOKEN)?.value;
  const userId = cookieStore.get(AUTH_COOKIE_MAP.USER_ID)?.value;

  if (!refreshTokenRaw || !userId) {
    return NextResponse.json(
      { message: "Missing refresh credentials" },
      { status: 401 },
    );
  }

  const api = await createApi(false);
  const { data, error } = await api.POST("/auth/refresh", {
    body: { refreshTokenRaw, userId },
  });

  if (error || !data?.accessToken) {
    return NextResponse.json(error ?? { message: "Invalid refresh response" }, {
      status: error ? (error as ApiError).statusCode : 502,
    });
  }

  const response = NextResponse.json({
    accessToken: data.accessToken,
    user: data.user,
  });

  response.cookies.set(AUTH_COOKIE_MAP.ACCESS_TOKEN, data.accessToken, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 15 * 60,
  });

  return response;
}
