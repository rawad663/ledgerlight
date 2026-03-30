import * as React from "react";

import { useApiClient } from "@/hooks/use-api";
import { type components } from "@/lib/api-types";

type LocationDto = components["schemas"]["LocationDto"];

type UseLocationsOptions = {
  enabled?: boolean;
  initialLocations?: LocationDto[];
};

export function useLocations(options: UseLocationsOptions = {}) {
  const { enabled = true, initialLocations = [] } = options;
  const apiClient = useApiClient();
  const [locations, setLocations] =
    React.useState<LocationDto[]>(initialLocations);

  React.useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;

    // TODO: this should be replaced with a call to a /locations endpoint
    // once implemented in the backend
    apiClient
      .GET("/inventory/levels", { params: { query: { limit: 1 } } })
      .then(({ data }) => {
        if (!cancelled) {
          setLocations(data?.locations ?? []);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [apiClient, enabled]);

  return locations;
}
