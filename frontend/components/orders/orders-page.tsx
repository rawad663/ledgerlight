"use client"

import * as React from "react"
import Link from "next/link"
import {
  Plus,
  Search,
  Filter,
  Download,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const orders = [
  {
    id: "ORD-7821",
    customer: "Emily Parker",
    email: "emily.p@email.com",
    status: "Pending",
    items: 3,
    total: 245.0,
    location: "Downtown Store",
    createdAt: "Mar 23, 2026 10:42 AM",
  },
  {
    id: "ORD-7820",
    customer: "James Wilson",
    email: "jwilson@company.com",
    status: "Placed",
    items: 1,
    total: 89.99,
    location: "Main Street",
    createdAt: "Mar 23, 2026 10:15 AM",
  },
  {
    id: "ORD-7819",
    customer: "Maria Garcia",
    email: "maria.g@email.com",
    status: "Placed",
    items: 5,
    total: 412.5,
    location: "Downtown Store",
    createdAt: "Mar 23, 2026 09:58 AM",
  },
  {
    id: "ORD-7818",
    customer: "David Chen",
    email: "d.chen@email.com",
    status: "Cancelled",
    items: 2,
    total: 156.0,
    location: "Westside Mall",
    createdAt: "Mar 23, 2026 09:32 AM",
  },
  {
    id: "ORD-7817",
    customer: "Sophie Brown",
    email: "sophie.b@email.com",
    status: "Placed",
    items: 4,
    total: 328.75,
    location: "Main Street",
    createdAt: "Mar 23, 2026 08:45 AM",
  },
  {
    id: "ORD-7816",
    customer: "Michael Torres",
    email: "m.torres@email.com",
    status: "Placed",
    items: 2,
    total: 175.5,
    location: "Downtown Store",
    createdAt: "Mar 22, 2026 05:30 PM",
  },
  {
    id: "ORD-7815",
    customer: "Lisa Anderson",
    email: "lisa.a@company.com",
    status: "Pending",
    items: 6,
    total: 589.0,
    location: "Westside Mall",
    createdAt: "Mar 22, 2026 04:15 PM",
  },
  {
    id: "ORD-7814",
    customer: "Robert Kim",
    email: "r.kim@email.com",
    status: "Placed",
    items: 1,
    total: 45.0,
    location: "Main Street",
    createdAt: "Mar 22, 2026 03:22 PM",
  },
  {
    id: "ORD-7813",
    customer: "Amanda Foster",
    email: "a.foster@email.com",
    status: "Cancelled",
    items: 3,
    total: 234.25,
    location: "Downtown Store",
    createdAt: "Mar 22, 2026 02:10 PM",
  },
  {
    id: "ORD-7812",
    customer: "Christopher Lee",
    email: "c.lee@company.com",
    status: "Placed",
    items: 2,
    total: 167.99,
    location: "Westside Mall",
    createdAt: "Mar 22, 2026 01:45 PM",
  },
]

const statusColors: Record<string, string> = {
  Pending: "bg-warning/15 text-warning-foreground border-warning/30",
  Placed: "bg-success/15 text-success border-success/30",
  Cancelled: "bg-destructive/15 text-destructive border-destructive/30",
}

export function OrdersPage() {
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState("all")
  const [locationFilter, setLocationFilter] = React.useState("all")

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.id.toLowerCase().includes(search.toLowerCase()) ||
      order.customer.toLowerCase().includes(search.toLowerCase()) ||
      order.email.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === "all" || order.status === statusFilter
    const matchesLocation = locationFilter === "all" || order.location === locationFilter
    return matchesSearch && matchesStatus && matchesLocation
  })

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
          <p className="text-sm text-muted-foreground">
            Manage and track all customer orders across locations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-1.5 size-4" />
            Export
          </Button>
          <Button size="sm" asChild>
            <Link href="/orders/new">
              <Plus className="mr-1.5 size-4" />
              Create Order
            </Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by order ID or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="Placed">Placed</SelectItem>
            <SelectItem value="Cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={locationFilter} onValueChange={setLocationFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Location" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            <SelectItem value="Downtown Store">Downtown Store</SelectItem>
            <SelectItem value="Main Street">Main Street</SelectItem>
            <SelectItem value="Westside Mall">Westside Mall</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" className="shrink-0">
          <Calendar className="size-4" />
          <span className="sr-only">Date range</span>
        </Button>
      </div>

      {/* Orders Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[120px]">Order ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Items</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-muted-foreground">No orders found</p>
                    <Button variant="outline" size="sm" onClick={() => {
                      setSearch("")
                      setStatusFilter("all")
                      setLocationFilter("all")
                    }}>
                      Clear filters
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((order) => (
                <TableRow key={order.id} className="cursor-pointer group">
                  <TableCell>
                    <Link
                      href={`/orders/${order.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {order.id}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{order.customer}</p>
                      <p className="text-xs text-muted-foreground">{order.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn("font-medium", statusColors[order.status])}
                    >
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">{order.items}</TableCell>
                  <TableCell className="text-right font-medium">
                    ${order.total.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{order.location}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {order.createdAt}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal className="size-4" />
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/orders/${order.id}`}>View details</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem>Edit order</DropdownMenuItem>
                        <DropdownMenuItem>Print receipt</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive">
                          Cancel order
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t px-4 py-3">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-medium">{filteredOrders.length}</span> of{" "}
            <span className="font-medium">{orders.length}</span> orders
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled>
              <ChevronLeft className="mr-1 size-4" />
              Previous
            </Button>
            <Button variant="outline" size="sm">
              Next
              <ChevronRight className="ml-1 size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
