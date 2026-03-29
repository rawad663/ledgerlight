import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

export function useUrlSearch(initialSearch: string) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchInput, setSearchInput] = useState(initialSearch);
  const debouncedSearchInput = useDebouncedValue(searchInput, 300);

  // Debounce search input → URL param
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (debouncedSearchInput) {
      params.set("search", debouncedSearchInput);
    } else {
      params.delete("search");
    }
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`);
  }, [debouncedSearchInput]); // eslint-disable-line react-hooks/exhaustive-deps

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
