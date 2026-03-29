"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";

import { AUTH_COOKIE_MAP } from "@/lib/api-config";
import { decodeJwtPayload, type JwtUser } from "@/lib/jwt";

import { useCookies } from "./use-cookies";

export type AuthMembership = {
  organizationId: string;
  role: string;
  organizationName: string;
};

type AuthContextValue = {
  user: JwtUser | null;
  memberships: AuthMembership[];
  currentOrg: { id: string; name: string } | null;
  currentRole: string | null;
  switchOrganization: (orgId: string) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { getCookie, setCookie } = useCookies();

  const auth = useMemo<AuthContextValue>(() => {
    const token = getCookie(AUTH_COOKIE_MAP.ACCESS_TOKEN);
    const orgId = getCookie(AUTH_COOKIE_MAP.X_ORGANIZATION_ID);
    const noAuth: AuthContextValue = {
      user: null,
      memberships: [],
      currentOrg: null,
      currentRole: null,
      switchOrganization: () => {},
    };

    if (!token) return noAuth;

    const payload = decodeJwtPayload(token);
    if (!payload) return noAuth;

    const memberships: AuthMembership[] = payload.memberships.map((m) => ({
      organizationId: m.organizationId,
      role: m.role,
      organizationName: m.organizationName,
    }));

    const currentMembership = memberships.find(
      (m) => m.organizationId === orgId,
    );

    const currentOrg = currentMembership
      ? {
          id: currentMembership.organizationId,
          name: currentMembership.organizationName,
        }
      : null;

    return {
      user: payload.user,
      memberships,
      currentOrg,
      currentRole: currentMembership?.role ?? null,
      switchOrganization: (newOrgId: string) => {
        const valid = memberships.some((m) => m.organizationId === newOrgId);
        if (!valid) return;

        setCookie(AUTH_COOKIE_MAP.X_ORGANIZATION_ID, newOrgId);
        window.location.reload();
      },
    };
  }, [getCookie, setCookie]);

  return <AuthContext value={auth}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
