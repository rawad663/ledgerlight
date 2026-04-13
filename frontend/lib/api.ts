import { cookies, headers } from "next/headers";
import createClient from "openapi-fetch";

import { type ApiPaths, AUTH_COOKIE_MAP } from "./api-config";
import { buildCorrelationHeaders } from "./server-observability";

export async function createApi(withAuthHeaders: boolean = true) {
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const token = cookieStore.get(AUTH_COOKIE_MAP.ACCESS_TOKEN)?.value;
  const orgId = cookieStore.get(AUTH_COOKIE_MAP.X_ORGANIZATION_ID)?.value ?? "";
  const { headers: correlationHeaders } = buildCorrelationHeaders(requestHeaders, {
    ...(withAuthHeaders && token ? { Authorization: `Bearer ${token}` } : {}),
    ...(withAuthHeaders ? { "X-Organization-Id": orgId } : {}),
  });

  return createClient<ApiPaths>({
    baseUrl: process.env.NEXT_PUBLIC_API_URL!,
    headers: Object.fromEntries(correlationHeaders.entries()),
  });
}
