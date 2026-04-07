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
  role: string; // "OWNER" | "MANAGER" | "CASHIER" | "SUPPORT" | "INVENTORY_CLERK"
  hasAllLocations: boolean;
  allowedLocationIds: string[];
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
    const decoded =
      typeof atob === "function"
        ? atob(base64)
        : Buffer.from(base64, "base64").toString("utf8");

    return JSON.parse(decoded);
  } catch {
    return null;
  }
}
