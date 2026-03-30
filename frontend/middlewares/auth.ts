import { NextRequest, NextResponse } from "next/server";

import { AUTH_COOKIE_MAP } from "@/lib/api-config";

function isTokenExpired(token: string): boolean {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(base64));

    // Refresh if token expires within 60 seconds
    return payload.exp * 1000 < Date.now() + 60_000;
  } catch {
    return true;
  }
}

const { ACCESS_TOKEN, REFRESH_TOKEN, USER_ID } = AUTH_COOKIE_MAP;

function redirectToLogin(request: NextRequest) {
  const url = new URL("/login", request.url);
  url.searchParams.set("returnTo", request.nextUrl.pathname);

  return NextResponse.redirect(url);
}

export async function authMiddleware(request: NextRequest) {
  const accessToken = request.cookies.get(ACCESS_TOKEN)?.value;
  const refreshToken = request.cookies.get(REFRESH_TOKEN)?.value;
  const userId = request.cookies.get(USER_ID)?.value;
  const isLoginPage = request.nextUrl.pathname === "/login";

  if ((!refreshToken || !userId) && !isLoginPage) {
    return redirectToLogin(request);
  }

  if (isLoginPage) {
    if (accessToken && !isTokenExpired(accessToken)) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.next();
  }

  if (accessToken && !isTokenExpired(accessToken)) {
    return NextResponse.next();
  }

  // Token is missing or expired — refresh it
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, refreshTokenRaw: refreshToken }),
  });

  if (!res.ok) {
    // Refresh failed — clear stale tokens and continue
    const response = redirectToLogin(request);
    response.cookies.delete(ACCESS_TOKEN);
    response.cookies.delete(REFRESH_TOKEN);
    response.cookies.delete(USER_ID);

    return response;
  }

  const data = await res.json();

  if (!data?.accessToken || typeof data.accessToken !== "string") {
    const response = redirectToLogin(request);
    response.cookies.delete(ACCESS_TOKEN);
    response.cookies.delete(REFRESH_TOKEN);
    response.cookies.delete(USER_ID);
    return response;
  }

  const response = NextResponse.next();
  response.cookies.set(ACCESS_TOKEN, data.accessToken, {
    httpOnly: false, // Client JS needs to read this for Authorization header
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 15 * 60,
  });

  return response;
}
