export type JwtUser = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type JwtMembership = {
  id: string;
  userId: string;
  organizationId: string;
  organizationName: string;
  role: string; // "ADMIN" | "MANAGER" | "SUPPORT"
};

export type JwtPayload = {
  sub: string;
  user: JwtUser;
  memberships: JwtMembership[];
  iat: number;
  exp: number;
};

export function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}
