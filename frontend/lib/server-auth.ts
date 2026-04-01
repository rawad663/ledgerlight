import { cookies } from "next/headers";

import { AUTH_COOKIE_MAP } from "@/lib/api-config";
import { decodeJwtPayload } from "@/lib/jwt";

export async function getServerCurrentRole(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_MAP.ACCESS_TOKEN)?.value;
  const organizationId =
    cookieStore.get(AUTH_COOKIE_MAP.X_ORGANIZATION_ID)?.value ?? null;

  if (!token || !organizationId) {
    return null;
  }

  const payload = decodeJwtPayload(token);
  const membership = payload?.memberships.find(
    (item) => item.organizationId === organizationId,
  );

  return membership?.role ?? null;
}
