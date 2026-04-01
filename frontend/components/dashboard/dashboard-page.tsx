"use client";

import {
  AlertTriangle,
  DollarSign,
  Plus,
  ShoppingCart,
  Users,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { SalesOverviewCard } from "@/components/dashboard/sales-overview-card";
import { CreateOrderForm } from "@/components/orders/create-order-form";
import { PageHeader } from "@/components/shared/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type components } from "@/lib/api-types";
import {
  formatCurrencyCents,
  formatDateTime,
  formatEnumLabel,
  formatOrderId,
} from "@/lib/formatters";
import { ORDER_STATUS_STYLES } from "@/lib/status";

type DashboardSalesOverview = components["schemas"]["DashboardSalesOverviewDto"];
type DashboardSummary = components["schemas"]["DashboardSummaryDto"];
type DashboardLowStockItem = components["schemas"]["AggregatedInventoryItemDto"];
type DashboardRecentOrder = components["schemas"]["OrderListItemDto"];

export type DashboardPageProps = {
  summary: DashboardSummary | null;
  summaryError?: string | null;
  salesOverview: DashboardSalesOverview | null;
  salesOverviewError?: string | null;
  recentOrders: DashboardRecentOrder[];
  recentOrdersError?: string | null;
  recentOrdersHref: string;
  lowStockItems: DashboardLowStockItem[];
  lowStockError?: string | null;
  lowStockHref: string;
};

const metricCards = [
  {
    key: "todaysSalesCents",
    label: "Today's Sales",
    icon: DollarSign,
    iconClassName: "bg-primary/10 text-primary",
    formatValue: (summary: DashboardSummary | null) =>
      formatCurrencyCents(summary?.todaysSalesCents ?? 0),
  },
  {
    key: "ordersTodayCount",
    label: "Orders Today",
    icon: ShoppingCart,
    iconClassName: "bg-chart-2/15 text-chart-2",
    formatValue: (summary: DashboardSummary | null) =>
      String(summary?.ordersTodayCount ?? 0),
  },
  {
    key: "lowStockItemsCount",
    label: "Low Stock Items",
    icon: AlertTriangle,
    iconClassName: "bg-warning/15 text-warning",
    formatValue: (summary: DashboardSummary | null) =>
      String(summary?.lowStockItemsCount ?? 0),
  },
  {
    key: "activeCustomersCount",
    label: "Active Customers",
    icon: Users,
    iconClassName: "bg-chart-5/15 text-chart-5",
    formatValue: (summary: DashboardSummary | null) =>
      String(summary?.activeCustomersCount ?? 0),
  },
] as const;

function DashboardSectionError({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <Alert variant="destructive">
      <AlertTriangle className="size-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

function formatOrderTimestamp(order: DashboardRecentOrder): string {
  return formatDateTime(order.placedAt ?? order.createdAt);
}

function formatLocationBreakdown(item: DashboardLowStockItem): string {
  if (item.locations.length === 0) {
    return "No inventory across locations";
  }

  return item.locations
    .map((location) => `${location.locationName}: ${location.quantity}`)
    .join(", ");
}

export function DashboardPage({
  summary,
  summaryError,
  salesOverview,
  salesOverviewError,
  recentOrders,
  recentOrdersError,
  recentOrdersHref,
  lowStockItems,
  lowStockError,
  lowStockHref,
}: DashboardPageProps) {
  const [isCreateOrderOpen, setIsCreateOrderOpen] = React.useState(false);

  return (
    <>
      <div className="space-y-6 p-6">
        <PageHeader
          title="Dashboard"
          description="Welcome back. Here’s what’s happening in the business today."
          actions={
            <>
              <Button variant="outline" size="sm" asChild>
                <Link href="/reports">View Reports</Link>
              </Button>
              <Button size="sm" onClick={() => setIsCreateOrderOpen(true)}>
                <Plus className="mr-1.5 size-4" />
                Create Order
              </Button>
            </>
          }
        />

        {summaryError ? (
          <DashboardSectionError
            title="Dashboard metrics unavailable"
            message={summaryError}
          />
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {metricCards.map((metric) => {
            const Icon = metric.icon;

            return (
              <Card key={metric.key} className="py-4">
                <CardContent className="flex items-center gap-4">
                  <div
                    className={`flex size-12 items-center justify-center rounded-lg ${metric.iconClassName}`}
                  >
                    <Icon className="size-6" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-muted-foreground">
                      {metric.label}
                    </p>
                    <p className="text-2xl font-semibold">
                      {metric.formatValue(summary)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <SalesOverviewCard
            salesOverview={salesOverview}
            salesOverviewError={salesOverviewError}
          />

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Low Stock Watchlist</CardTitle>
                  <CardDescription>
                    Products sorted by the biggest gap to their reorder threshold.
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={lowStockHref}>View More</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {lowStockError ? (
                <div className="p-6">
                  <DashboardSectionError
                    title="Low stock inventory unavailable"
                    message={lowStockError}
                  />
                </div>
              ) : lowStockItems.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">
                  No products are currently below their reorder threshold.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Reorder At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lowStockItems.map((item) => (
                      <TableRow key={item.productId}>
                        <TableCell>
                          <div className="font-medium">{item.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.sku}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {formatLocationBreakdown(item)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-destructive">
                          {item.totalQuantity}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {item.reorderThreshold}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">Recent Orders</CardTitle>
                <CardDescription>
                  Live order activity using the same view model as the orders page.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href={recentOrdersHref}>View More</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {recentOrdersError ? (
              <div className="p-6">
                <DashboardSectionError
                  title="Recent orders unavailable"
                  message={recentOrdersError}
                />
              </div>
            ) : recentOrders.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">
                No recent orders match the current dashboard view.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/orders/${order.id}`}
                          className="hover:text-primary"
                        >
                          {formatOrderId(order.id)}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {order.customer?.name ?? "Walk-in customer"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={ORDER_STATUS_STYLES[order.status]}
                        >
                          {formatEnumLabel(order.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatCurrencyCents(order.totalCents)}</TableCell>
                      <TableCell>{formatOrderTimestamp(order)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <CreateOrderForm
        open={isCreateOrderOpen}
        onOpenChange={setIsCreateOrderOpen}
      />
    </>
  );
}
