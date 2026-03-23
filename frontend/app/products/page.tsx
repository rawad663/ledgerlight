import { AppShell } from "@/components/app-shell";
import { ProductsPage } from "@/components/products/products-page";
import { createApi } from "@/lib/api";

export default async function Products() {
  const api = await createApi();
  const { data } = await api.GET("/products/{id}", {
    params: { path: { id: "5" } },
  });

  const products = data?.data ?? [];

  return (
    <AppShell>
      <ProductsPage
        products={products.map((p) => ({
          ...p,
          category: p.category ?? "Outerwear",
          stock: 12,
          inventory: "In Stock",
          price: p.priceCents / 100,
        }))}
      />
    </AppShell>
  );
}
