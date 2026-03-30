import { cookies } from "next/headers";
import createClient from "openapi-fetch";

import { type ApiPaths, AUTH_COOKIE_MAP } from "./api-config";

export async function createApi(withAuthHeaders: boolean = true) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_MAP.ACCESS_TOKEN)?.value;
  const orgId = cookieStore.get(AUTH_COOKIE_MAP.X_ORGANIZATION_ID)?.value ?? "";

  return createClient<ApiPaths>({
    baseUrl: process.env.NEXT_PUBLIC_API_URL!,
    headers: withAuthHeaders
      ? {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "X-Organization-Id": orgId,
        }
      : {},
  });
}
