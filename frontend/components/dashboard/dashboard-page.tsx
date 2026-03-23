"use client"

import * as React from "react"
import Link from "next/link"
import {
  DollarSign,
  ShoppingCart,
  AlertTriangle,
  Users,
  Plus,
  Package,
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal,
  TrendingUp,
} from "lucide-react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const salesData = [
  { date: "Mon", sales: 2400 },
  { date: "Tue", sales: 1398 },
  { date: "Wed", sales: 3200 },
  { date: "Thu", sales: 2780 },
  { date: "Fri", sales: 4890 },
  { date: "Sat", sales: 5390 },
  { date: "Sun", sales: 3490 },
]

const recentOrders = [
  {
    id: "ORD-7821",
    customer: "Emily Parker",
    status: "Pending",
    items: 3,
    total: "$245.00",
    time: "2 min ago",
  },
  {
    id: "ORD-7820",
    customer: "James Wilson",
    status: "Placed",
    items: 1,
    total: "$89.99",
    time: "15 min ago",
  },
  {
    id: "ORD-7819",
    customer: "Maria Garcia",
    status: "Placed",
    items: 5,
    total: "$412.50",
    time: "32 min ago",
  },
  {
    id: "ORD-7818",
    customer: "David Chen",
    status: "Cancelled",
    items: 2,
    total: "$156.00",
    time: "1 hr ago",
  },
  {
    id: "ORD-7817",
    customer: "Sophie Brown",
    status: "Placed",
    items: 4,
    total: "$328.75",
    time: "2 hr ago",
  },
]

const lowStockItems = [
  {
    name: "Classic White T-Shirt (M)",
    sku: "CWT-001-M",
    stock: 3,
    reorderPoint: 10,
  },
  {
    name: "Vintage Denim Jacket",
    sku: "VDJ-042",
    stock: 2,
    reorderPoint: 5,
  },
  {
    name: "Canvas Tote Bag - Natural",
    sku: "CTB-015-N",
    stock: 5,
    reorderPoint: 15,
  },
  {
    name: "Wool Beanie - Charcoal",
    sku: "WBN-008-C",
    stock: 4,
    reorderPoint: 12,
  },
]

const statusColors: Record<string, string> = {
  Pending: "bg-warning/15 text-warning-foreground border-warning/30",
  Placed: "bg-success/15 text-success border-success/30",
  Cancelled: "bg-destructive/15 text-destructive border-destructive/30",
}

export function DashboardPage() {
  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Welcome back, Sarah. Here&apos;s what&apos;s happening today.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            View Reports
          </Button>
          <Button size="sm">
            <Plus className="mr-1.5 size-4" />
            Create Order
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="py-4">
          <CardContent className="flex items-center gap-4">
            <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10">
              <DollarSign className="size-6 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-muted-foreground">Today&apos;s Sales</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-semibold">$4,285</p>
                <span className="flex items-center text-xs font-medium text-success">
                  <ArrowUpRight className="size-3" />
                  12%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="py-4">
          <CardContent className="flex items-center gap-4">
            <div className="flex size-12 items-center justify-center rounded-lg bg-chart-2/15">
              <ShoppingCart className="size-6 text-chart-2" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-muted-foreground">Orders Today</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-semibold">28</p>
                <span className="flex items-center text-xs font-medium text-success">
                  <ArrowUpRight className="size-3" />
                  8%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="py-4">
          <CardContent className="flex items-center gap-4">
            <div className="flex size-12 items-center justify-center rounded-lg bg-warning/15">
              <AlertTriangle className="size-6 text-warning" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-muted-foreground">Low Stock Items</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-semibold">12</p>
                <span className="flex items-center text-xs font-medium text-destructive">
                  <ArrowDownRight className="size-3" />
                  3
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="py-4">
          <CardContent className="flex items-center gap-4">
            <div className="flex size-12 items-center justify-center rounded-lg bg-chart-5/15">
              <Users className="size-6 text-chart-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-muted-foreground">Active Customers</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-semibold">1,284</p>
                <span className="flex items-center text-xs font-medium text-success">
                  <ArrowUpRight className="size-3" />
                  5%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Sales Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Sales Overview</CardTitle>
                <CardDescription>This week&apos;s sales performance</CardDescription>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="size-4 text-success" />
                <span className="font-medium text-success">+18.2%</span>
                <span className="text-muted-foreground">vs last week</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "8px",
                      fontSize: 12,
                    }}
                    formatter={(value: number) => [`$${value.toLocaleString()}`, "Sales"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="sales"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    fill="url(#salesGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quick Actions</CardTitle>
            <CardDescription>Common tasks and shortcuts</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Button variant="outline" className="h-auto justify-start gap-3 px-3 py-3" asChild>
              <Link href="/orders/new">
                <div className="flex size-9 items-center justify-center rounded-md bg-primary/10">
                  <ShoppingCart className="size-4 text-primary" />
                </div>
                <div className="flex flex-col items-start">
                  <span className="font-medium">Create Order</span>
                  <span className="text-xs text-muted-foreground">New sale or invoice</span>
                </div>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto justify-start gap-3 px-3 py-3" asChild>
              <Link href="/products/new">
                <div className="flex size-9 items-center justify-center rounded-md bg-chart-2/15">
                  <Package className="size-4 text-chart-2" />
                </div>
                <div className="flex flex-col items-start">
                  <span className="font-medium">Add Product</span>
                  <span className="text-xs text-muted-foreground">Create new listing</span>
                </div>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto justify-start gap-3 px-3 py-3" asChild>
              <Link href="/inventory/adjust">
                <div className="flex size-9 items-center justify-center rounded-md bg-warning/15">
                  <AlertTriangle className="size-4 text-warning" />
                </div>
                <div className="flex flex-col items-start">
                  <span className="font-medium">Adjust Inventory</span>
                  <span className="text-xs text-muted-foreground">Update stock levels</span>
                </div>
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Tables Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Orders */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Recent Orders</CardTitle>
                <CardDescription>Latest transactions from all locations</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/orders">View all</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-2">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right pr-6">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentOrders.map((order) => (
                  <TableRow key={order.id} className="cursor-pointer">
                    <TableCell className="pl-6">
                      <div>
                        <p className="font-medium">{order.id}</p>
                        <p className="text-xs text-muted-foreground">{order.time}</p>
                      </div>
                    </TableCell>
                    <TableCell>{order.customer}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn("font-medium", statusColors[order.status])}
                      >
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-6 font-medium">{order.total}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Low Stock Alert */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="size-4 text-warning" />
                  Low Stock Alert
                </CardTitle>
                <CardDescription>Products below reorder threshold</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/inventory?filter=low">View all</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-2">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Product</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right pr-6">Reorder</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowStockItems.map((item) => (
                  <TableRow key={item.sku}>
                    <TableCell className="pl-6">
                      <div>
                        <p className="font-medium truncate max-w-[200px]">{item.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{item.sku}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                        {item.stock}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-6 text-muted-foreground">
                      {item.reorderPoint}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
