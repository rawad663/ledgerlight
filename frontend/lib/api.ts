import { cookies } from "next/headers";
import createClient from "openapi-fetch";
import { AUTH_HEADER_COOKIE_MAP, type ApiPaths } from "./api-config";

export { AUTH_HEADER_COOKIE_MAP } from "./api-config";

export async function createApi() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_HEADER_COOKIE_MAP.ACCESS_TOKEN)?.value;
  const orgId = cookieStore.get(
    AUTH_HEADER_COOKIE_MAP.X_ORGANIZATION_ID,
  )?.value ?? "";

  return createClient<ApiPaths>({
    baseUrl: process.env.NEXT_PUBLIC_API_URL!,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "X-Organization-Id": orgId,
    },
  });
}
