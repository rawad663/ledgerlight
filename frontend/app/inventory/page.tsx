import { AppShell } from "@/components/app-shell";
import { InventoryPage } from "@/components/inventory/inventory-page";
import { createApi } from "@/lib/api";

export default async function Inventory({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    location?: string;
    lowStockOnly?: string;
  }>;
}) {
  const { search, location, lowStockOnly } = await searchParams;
  const api = await createApi();
  const { data, error } = await api.GET("/inventory/levels", {
    params: {
      query: {
        limit: 50,
        search,
        locationId: location,
        lowStockOnly: lowStockOnly === "true" ? true : undefined,
      },
    },
  });

  if (error) {
    console.error(error);
  }

  return (
    <AppShell>
      <InventoryPage
        inventoryLevels={data?.data ?? []}
        total={data?.totalCount ?? 0}
        nextCursor={data?.nextCursor}
        locations={data?.locations ?? []}
        lowStockCount={data?.lowStockCount ?? 0}
        initialSearch={search ?? ""}
      />
    </AppShell>
  );
}
