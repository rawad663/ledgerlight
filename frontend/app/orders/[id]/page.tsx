import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { OrderDetailPage } from "@/components/orders/order-detail-page";
import { createApi } from "@/lib/api";

export default async function OrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const api = await createApi();

  const orderRes = await api.GET("/orders/{id}", {
    params: { path: { id }, query: { withItems: true } },
  });

  if (orderRes.error) {
    notFound();
  }

  const paymentId = orderRes.data?.payment?.id;

  const [orderAuditRes, paymentAuditRes] = await Promise.all([
    api.GET("/audit-logs", {
      params: {
        query: { entityType: "ORDER", entityId: id, limit: 50 },
      },
    }),
    paymentId
      ? api.GET("/audit-logs", {
          params: {
            query: { entityType: "PAYMENT", entityId: paymentId, limit: 50 },
          },
        })
      : Promise.resolve(null),
  ]);

  const auditLogs = [
    ...(orderAuditRes.data?.data ?? []),
    ...(paymentAuditRes?.data?.data ?? []),
  ].sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  return (
    <AppShell>
      <OrderDetailPage order={orderRes.data!} auditLogs={auditLogs} />
    </AppShell>
  );
}
