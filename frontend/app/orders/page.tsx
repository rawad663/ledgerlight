import { AppShell } from "@/components/app-shell";
import { OrdersPage } from "@/components/orders/orders-page";
import { createApi } from "@/lib/api";
import { components } from "@/lib/api-types";

type OrderStatus = components["schemas"]["OrderDto"]["status"] | undefined;
type SortOrder = "asc" | "desc" | undefined;

export default async function Orders({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    status?: string;
    location?: string;
    sortBy?: string;
    sortOrder?: SortOrder;
  }>;
}) {
  const { search, status, location, sortBy, sortOrder } = await searchParams;
  const api = await createApi();
  const { data, error } = await api.GET("/orders", {
    params: {
      query: {
        limit: 50,
        sortBy: sortBy ?? "createdAt",
        sortOrder: sortOrder ?? "desc",
        withItems: false,
        search,
        status: status as OrderStatus,
        locationId: location,
      },
    },
  });

  if (error) {
    console.error(error);
  }

  return (
    <AppShell>
      <OrdersPage
        orders={data?.data ?? []}
        total={data?.totalCount ?? 0}
        nextCursor={data?.nextCursor}
        locations={data?.locations ?? []}
        initialSearch={search ?? ""}
        initialSortBy={sortBy ?? "createdAt"}
        initialSortOrder={sortOrder ?? "desc"}
      />
    </AppShell>
  );
}
