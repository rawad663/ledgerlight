import { AppShell } from "@/components/app-shell";
import { OrderDetailPage } from "@/components/orders/order-detail-page";
import { createApi } from "@/lib/api";
import { notFound } from "next/navigation";

export default async function OrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const api = await createApi();

  const [orderRes, auditRes] = await Promise.all([
    api.GET("/orders/{id}", {
      params: { path: { id }, query: { withItems: true } },
    }),
    api.GET("/audit-logs", {
      params: {
        query: { entityType: "ORDER", entityId: id, limit: 50 },
      },
    }),
  ]);

  if (orderRes.error) {
    notFound();
  }

  return (
    <AppShell>
      <OrderDetailPage
        order={orderRes.data!}
        auditLogs={auditRes.data?.data ?? []}
      />
    </AppShell>
  );
}
