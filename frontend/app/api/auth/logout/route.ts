import { NextRequest, NextResponse } from "next/server";

import { createApi } from "@/lib/api";
import { ApiError, AUTH_COOKIE_MAP } from "@/lib/api-config";

export async function POST(_: NextRequest) {
  const api = await createApi();
  const { error } = await api.POST("/auth/logout");

  const response = NextResponse.json(
    error ? { error: (error as ApiError).message } : { success: true },
    { status: error ? (error as ApiError).statusCode : 200 },
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
