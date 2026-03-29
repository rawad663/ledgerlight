import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useDebouncedValue } from "@/hooks/use-debounced-value";

export function useUrlSearch(initialSearch: string) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsKey = useMemo(
    () => searchParams.toString(),
    [searchParams],
  );

  const [searchInput, setSearchInput] = useState(initialSearch);
  const debouncedSearchInput = useDebouncedValue(searchInput, 300);

  useEffect(() => {
    const params = new URLSearchParams(searchParamsKey);
    if (debouncedSearchInput) {
      params.set("search", debouncedSearchInput);
    } else {
      params.delete("search");
    }
    const currentSearchValue = searchParams.get("search") ?? "";

    if (currentSearchValue === debouncedSearchInput) {
      return;
    }

    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`);
  }, [debouncedSearchInput, pathname, router, searchParams, searchParamsKey]);

  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(updates)) {
      if (!value || value === "all" || value === "false") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`);
  }

  return {
    searchParams,
    searchInput,
    setSearchInput,
    updateParams,
  };
}
