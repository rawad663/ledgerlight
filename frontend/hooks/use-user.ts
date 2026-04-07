"use client";

import { useMemo, useSyncExternalStore } from "react";

import { AUTH_COOKIE_MAP } from "@/lib/api-config";
import { decodeJwtPayload, type JwtPayload } from "@/lib/jwt";

import { useCookies } from "./use-cookies";

export type User = JwtPayload;

export function useUser(): User | null {
  const { getCookie } = useCookies();
  const hasHydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  return useMemo(() => {
    if (!hasHydrated) {
      return null;
    }

    const token = getCookie(AUTH_COOKIE_MAP.ACCESS_TOKEN);
    if (!token) {
      return null;
    }

    return decodeJwtPayload(token) ?? null;
  }, [getCookie, hasHydrated]);
}
