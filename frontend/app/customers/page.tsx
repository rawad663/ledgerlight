import { AppShell } from "@/components/app-shell";
import { CustomersPage } from "@/components/customers/customers-page";
import { createApi } from "@/lib/api";

export default async function Customers({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
  }>;
}) {
  const { search } = await searchParams;
  const api = await createApi();
  const { data, error } = await api.GET("/customers", {
    params: {
      query: {
        limit: 50,
        search,
        sortBy: "updatedAt",
        sortOrder: "desc",
      },
    },
  });

  if (error) {
    console.error(error);
  }

  return (
    <AppShell>
      <CustomersPage
        customers={data?.data ?? []}
        total={data?.totalCount ?? 0}
        nextCursor={data?.nextCursor}
        initialSearch={search ?? ""}
      />
    </AppShell>
  );
}
