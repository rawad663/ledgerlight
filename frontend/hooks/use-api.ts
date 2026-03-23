import { useState, useEffect, useCallback, useMemo } from "react";
import createClient from "openapi-fetch";
import type { PathsWithMethod } from "openapi-typescript-helpers";
import { AUTH_HEADER_COOKIE_MAP, type ApiPaths } from "@/lib/api-config";
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

export function useApiClient() {
  const { getCookie } = useCookies();
  const token = getCookie(AUTH_HEADER_COOKIE_MAP.ACCESS_TOKEN);
  const orgId = getCookie(AUTH_HEADER_COOKIE_MAP.X_ORGANIZATION_ID);

  return useMemo(
    () =>
      createClient<ApiPaths>({
        baseUrl: process.env.NEXT_PUBLIC_API_URL!,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "X-Organization-Id": orgId ?? "",
        },
      }),
    [token, orgId],
  );
}

// For reads (GET) — auto-fetches on mount/path change
export function useGet<P extends GetPaths>(path: P | null) {
  type Op = ApiPaths[P] extends { get: infer G } ? G : never;
  type Data = ResponseData<Op>;

  const client = useApiClient();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);

  useEffect(() => {
    if (!path) return;

    let cancelled = false;
    setLoading(true);

    (client.GET as Function)(path)
      .then((result: { data?: Data; error?: unknown }) => {
        if (cancelled) return;
        if (result.error) {
          setError(String(result.error));
        } else {
          setData(result.data ?? null);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [path, client]);

  return { data, error, loading };
}

// For mutations — manages loading/error state, delegates to client
export function useMutation() {
  const client = useApiClient();
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
      } catch (err: any) {
        setError(err.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [client],
  );

  return { mutate, loading, error };
}

/**
"use client";
import { useGet, useMutation } from "@/hooks/use-api";

function ProductList() {
  // GET — auto-fetches, fully typed from OpenAPI spec
  const { data, loading } = useGet("/products");
  const products = data?.data ?? [];

  // Mutations — pass a callback that receives the typed client
  const { mutate: exec, loading: saving } = useMutation();

  const handleCreate = async () => {
    const product = await exec((api) =>
      api.POST("/products", {
        body: { name: "New", sku: "SKU-1", priceCents: 999 },
      })
    );
  };

  const handleUpdate = async (id: string) => {
    await exec((api) =>
      api.PATCH("/products/{id}", {
        params: { path: { id } },
        body: { name: "Updated" },
      })
    );
  };

  if (loading) return <Spinner />;
  // ...
}
*/
