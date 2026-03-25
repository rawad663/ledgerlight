import { AppShell } from "@/components/app-shell";
import {
  ProductsPage,
  PRODUCTS_PAGE_LIMIT,
} from "@/components/products/products-page";
import { createApi } from "@/lib/api";

export default async function Products() {
  const api = await createApi();
  const { data, error } = await api.GET("/products", {
    query: { limit: PRODUCTS_PAGE_LIMIT },
  });

  if (error) {
    console.error(error);
  }

  const products = data?.data ?? [];

  return (
    <AppShell>
      <ProductsPage
        products={products}
        total={data?.totalCount ?? 0}
        nextCursor={data?.nextCursor}
      />
    </AppShell>
  );
}
