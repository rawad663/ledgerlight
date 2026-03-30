// middleware.ts
import { NextRequest, NextResponse } from "next/server";

import { authMiddleware } from "@/middlewares/auth";

type MiddlewareFn = (
  request: NextRequest,
) => NextResponse | Response | Promise<NextResponse | Response> | null;

const middlewares: MiddlewareFn[] = [
  authMiddleware,
  // add more here
];

export async function proxy(request: NextRequest) {
  for (const mw of middlewares) {
    const result = await mw(request);
    if (result) return result; // short-circuit if middleware returns a response
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * match only paths from my application
     */
    "/((?!_next|api|favicon.ico|sitemap.xml|robots.txt|.*\\..*).*)",
  ],
};
