import createClient from "openapi-fetch";
import type { PathsWithMethod } from "openapi-typescript-helpers";
import { useCallback, useEffect, useMemo, useState } from "react";

import { type ApiPaths, AUTH_COOKIE_MAP } from "@/lib/api-config";

import { useCookies } from "./use-cookies";

type ApiClient = ReturnType<typeof createClient<ApiPaths>>;
type GetPaths = PathsWithMethod<ApiPaths, "get">;

// Extract success response data type from an operation
type ResponseData<Op> = Op extends {
  responses: { 200: { content: { "application/json": infer D } } };
}
  ? D
  : Op extends {
        responses: { 201: { content: { "application/json": infer D } } };
      }
    ? D
    : unknown;

export function useApiClient(withAuthHeaders = true) {
  const { getCookie } = useCookies();
  const token = getCookie(AUTH_COOKIE_MAP.ACCESS_TOKEN);
  const orgId = getCookie(AUTH_COOKIE_MAP.X_ORGANIZATION_ID);

  return useMemo(
    () =>
      createClient<ApiPaths>({
        baseUrl: process.env.NEXT_PUBLIC_API_URL!,
        headers: withAuthHeaders
          ? {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
              "X-Organization-Id": orgId ?? "",
            }
          : {},
      }),
    [token, orgId, withAuthHeaders],
  );
}

// For reads (GET) — auto-fetches on mount/path change
export function useGet<P extends GetPaths>(
  path: P | null,
  withAuthHeaders: boolean = true,
) {
  type Op = ApiPaths[P] extends { get: infer G } ? G : never;
  type Data = ResponseData<Op>;

  const client = useApiClient(withAuthHeaders);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resolvedPath, setResolvedPath] = useState<string | null>(path ?? null);

  useEffect(() => {
    if (!path) {
      return;
    }

    let cancelled = false;
    const getRequest = client.GET as unknown as (
      requestPath: P,
    ) => Promise<{ data?: Data; error?: unknown }>;

    getRequest(path)
      .then((result: { data?: Data; error?: unknown }) => {
        if (cancelled) return;
        if (result.error) {
          setError(String(result.error));
          setData(null);
        } else {
          setData(result.data ?? null);
          setError(null);
        }
        setResolvedPath(path);
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
          setData(null);
          setResolvedPath(path);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [path, client]);

  if (!path) {
    return { data: null, error: null, loading: false };
  }

  const isResolved = resolvedPath === path;

  return {
    data: isResolved ? data : null,
    error: isResolved ? error : null,
    loading: !isResolved,
  };
}

// For mutations — manages loading/error state, delegates to client
export function useMutation(withAuthHeaders: boolean = true) {
  const client = useApiClient(withAuthHeaders);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(
    async <T>(
      fn: (
        api: ApiClient,
      ) => Promise<{ data?: T; error?: unknown; response: Response }>,
    ): Promise<T | null> => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: apiError } = await fn(client);
        if (apiError) throw new Error(String(apiError));
        return data ?? null;
      } catch (err) {
        setError((err as Error).message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [client],
  );

  return { mutate, loading, error };
}
