import { AppShell } from "@/components/app-shell"
import { OrderDetailPage } from "@/components/orders/order-detail-page"

export default async function OrderDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  
  return (
    <AppShell>
      <OrderDetailPage orderId={id} />
    </AppShell>
  )
}
