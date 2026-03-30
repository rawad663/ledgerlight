"use client";

import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  DollarSign,
  Plus,
  ShoppingCart,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PageHeader } from "@/components/shared/page-header";
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
import { formatEnumLabel } from "@/lib/formatters";
import {
  dashboardLowStockItems,
  dashboardMetrics,
  dashboardRecentOrders,
  dashboardSalesData,
} from "@/lib/mocks/dashboard";
import { ORDER_STATUS_STYLES } from "@/lib/status";

const metricIcons = [DollarSign, ShoppingCart, AlertTriangle, Users];
const metricBackgroundStyles = [
  "bg-primary/10 text-primary",
  "bg-chart-2/15 text-chart-2",
  "bg-warning/15 text-warning",
  "bg-chart-5/15 text-chart-5",
];

export function DashboardPage() {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Dashboard"
        description="Welcome back, Sarah. Here's what's happening today."
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/reports">View Reports</Link>
            </Button>
            <Button size="sm">
              <Plus className="mr-1.5 size-4" />
              Create Order
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {dashboardMetrics.map((metric, index) => {
          const Icon = metricIcons[index];

          return (
            <Card key={metric.label} className="py-4">
              <CardContent className="flex items-center gap-4">
                <div
                  className={`flex size-12 items-center justify-center rounded-lg ${metricBackgroundStyles[index]}`}
                >
                  <Icon className="size-6" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    {metric.label}
                  </p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-semibold">{metric.value}</p>
                    <span
                      className={`flex items-center text-xs font-medium ${
                        metric.trendDirection === "up"
                          ? "text-success"
                          : "text-destructive"
                      }`}
                    >
                      {metric.trendDirection === "up" ? (
                        <ArrowUpRight className="size-3" />
                      ) : (
                        <ArrowDownRight className="size-3" />
                      )}
                      {metric.trend}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Sales Overview</CardTitle>
                <CardDescription>
                  This week&apos;s sales performance
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="size-4 text-success" />
                <span className="font-medium text-success">+18.2%</span>
                <span className="text-muted-foreground">vs last week</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dashboardSalesData}>
                  <defs>
                    <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tickMargin={10}
                  />
                  <YAxis axisLine={false} tickLine={false} tickMargin={10} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="sales"
                    stroke="var(--color-primary)"
                    fill="url(#salesGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Low Stock Watchlist</CardTitle>
            <CardDescription>Mock inventory alerts until live data is wired in</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboardLowStockItems.map((item) => (
              <div
                key={item.sku}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.sku}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-destructive">{item.stock}</p>
                  <p className="text-xs text-muted-foreground">
                    Reorder at {item.reorderPoint}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent Orders</CardTitle>
          <CardDescription>Mock orders used to keep the dashboard experience realistic</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dashboardRecentOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.id}</TableCell>
                  <TableCell>{order.customer}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={ORDER_STATUS_STYLES[order.status]}
                    >
                      {formatEnumLabel(order.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>{order.items}</TableCell>
                  <TableCell>{order.total}</TableCell>
                  <TableCell>{order.time}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
