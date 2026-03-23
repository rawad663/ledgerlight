"use client"

import * as React from "react"
import {
  Search,
  Download,
  Plus,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  X,
  ShoppingBag,
  DollarSign,
  Calendar,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent } from "@/components/ui/card"

const customers = [
  {
    id: "1",
    name: "Emily Parker",
    email: "emily.p@email.com",
    phone: "+1 (555) 123-4567",
    lifetimeSpend: 2847.5,
    ordersCount: 12,
    lastOrderDate: "Mar 23, 2026",
    initials: "EP",
    joinedDate: "Jan 15, 2024",
    recentOrders: [
      { id: "ORD-7821", date: "Mar 23, 2026", total: 245.0, status: "Pending" },
      { id: "ORD-7654", date: "Feb 28, 2026", total: 189.5, status: "Placed" },
      { id: "ORD-7432", date: "Feb 12, 2026", total: 312.0, status: "Placed" },
    ],
  },
  {
    id: "2",
    name: "James Wilson",
    email: "jwilson@company.com",
    phone: "+1 (555) 234-5678",
    lifetimeSpend: 1523.0,
    ordersCount: 8,
    lastOrderDate: "Mar 23, 2026",
    initials: "JW",
    joinedDate: "Mar 22, 2024",
    recentOrders: [
      { id: "ORD-7820", date: "Mar 23, 2026", total: 89.99, status: "Placed" },
      { id: "ORD-7501", date: "Feb 15, 2026", total: 245.0, status: "Placed" },
    ],
  },
  {
    id: "3",
    name: "Maria Garcia",
    email: "maria.g@email.com",
    phone: "+1 (555) 345-6789",
    lifetimeSpend: 4562.25,
    ordersCount: 24,
    lastOrderDate: "Mar 23, 2026",
    initials: "MG",
    joinedDate: "Nov 8, 2023",
    recentOrders: [
      { id: "ORD-7819", date: "Mar 23, 2026", total: 412.5, status: "Placed" },
      { id: "ORD-7712", date: "Mar 18, 2026", total: 156.0, status: "Placed" },
      { id: "ORD-7689", date: "Mar 10, 2026", total: 278.75, status: "Placed" },
    ],
  },
  {
    id: "4",
    name: "David Chen",
    email: "d.chen@email.com",
    phone: "+1 (555) 456-7890",
    lifetimeSpend: 892.0,
    ordersCount: 5,
    lastOrderDate: "Mar 23, 2026",
    initials: "DC",
    joinedDate: "Jun 3, 2025",
    recentOrders: [
      { id: "ORD-7818", date: "Mar 23, 2026", total: 156.0, status: "Cancelled" },
      { id: "ORD-7456", date: "Jan 22, 2026", total: 89.99, status: "Placed" },
    ],
  },
  {
    id: "5",
    name: "Sophie Brown",
    email: "sophie.b@email.com",
    phone: "+1 (555) 567-8901",
    lifetimeSpend: 3215.75,
    ordersCount: 18,
    lastOrderDate: "Mar 23, 2026",
    initials: "SB",
    joinedDate: "Aug 19, 2023",
    recentOrders: [
      { id: "ORD-7817", date: "Mar 23, 2026", total: 328.75, status: "Placed" },
      { id: "ORD-7698", date: "Mar 12, 2026", total: 195.5, status: "Placed" },
    ],
  },
  {
    id: "6",
    name: "Michael Torres",
    email: "m.torres@email.com",
    phone: "+1 (555) 678-9012",
    lifetimeSpend: 1876.5,
    ordersCount: 11,
    lastOrderDate: "Mar 22, 2026",
    initials: "MT",
    joinedDate: "Dec 1, 2024",
    recentOrders: [
      { id: "ORD-7816", date: "Mar 22, 2026", total: 175.5, status: "Placed" },
    ],
  },
  {
    id: "7",
    name: "Lisa Anderson",
    email: "lisa.a@company.com",
    phone: "+1 (555) 789-0123",
    lifetimeSpend: 5423.0,
    ordersCount: 32,
    lastOrderDate: "Mar 22, 2026",
    initials: "LA",
    joinedDate: "Feb 14, 2023",
    recentOrders: [
      { id: "ORD-7815", date: "Mar 22, 2026", total: 589.0, status: "Pending" },
      { id: "ORD-7745", date: "Mar 20, 2026", total: 234.25, status: "Placed" },
    ],
  },
  {
    id: "8",
    name: "Robert Kim",
    email: "r.kim@email.com",
    phone: "+1 (555) 890-1234",
    lifetimeSpend: 645.0,
    ordersCount: 4,
    lastOrderDate: "Mar 22, 2026",
    initials: "RK",
    joinedDate: "Sep 5, 2025",
    recentOrders: [
      { id: "ORD-7814", date: "Mar 22, 2026", total: 45.0, status: "Placed" },
    ],
  },
  {
    id: "9",
    name: "Amanda Foster",
    email: "a.foster@email.com",
    phone: "+1 (555) 901-2345",
    lifetimeSpend: 2134.75,
    ordersCount: 14,
    lastOrderDate: "Mar 22, 2026",
    initials: "AF",
    joinedDate: "Apr 20, 2024",
    recentOrders: [
      { id: "ORD-7813", date: "Mar 22, 2026", total: 234.25, status: "Cancelled" },
      { id: "ORD-7678", date: "Mar 8, 2026", total: 156.0, status: "Placed" },
    ],
  },
  {
    id: "10",
    name: "Christopher Lee",
    email: "c.lee@company.com",
    phone: "+1 (555) 012-3456",
    lifetimeSpend: 3567.25,
    ordersCount: 21,
    lastOrderDate: "Mar 22, 2026",
    initials: "CL",
    joinedDate: "Jul 10, 2023",
    recentOrders: [
      { id: "ORD-7812", date: "Mar 22, 2026", total: 167.99, status: "Placed" },
      { id: "ORD-7756", date: "Mar 21, 2026", total: 289.0, status: "Placed" },
    ],
  },
]

const statusColors: Record<string, string> = {
  Pending: "text-warning-foreground",
  Placed: "text-success",
  Cancelled: "text-destructive",
}

export function CustomersPage() {
  const [search, setSearch] = React.useState("")
  const [selectedCustomer, setSelectedCustomer] = React.useState<typeof customers[0] | null>(null)

  const filteredCustomers = customers.filter((customer) => {
    return (
      customer.name.toLowerCase().includes(search.toLowerCase()) ||
      customer.email.toLowerCase().includes(search.toLowerCase()) ||
      customer.phone.includes(search)
    )
  })

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">
            View and manage your customer database.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-1.5 size-4" />
            Export
          </Button>
          <Button size="sm">
            <Plus className="mr-1.5 size-4" />
            Add Customer
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Customers Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[250px]">Customer</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead className="text-right">Lifetime Spend</TableHead>
              <TableHead className="text-center">Orders</TableHead>
              <TableHead>Last Order</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCustomers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-muted-foreground">No customers found</p>
                    <Button variant="outline" size="sm" onClick={() => setSearch("")}>
                      Clear search
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredCustomers.map((customer) => (
                <TableRow
                  key={customer.id}
                  className="cursor-pointer group"
                  onClick={() => setSelectedCustomer(customer)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-9">
                        <AvatarImage src="" alt={customer.name} />
                        <AvatarFallback className="bg-primary/10 text-primary text-sm">
                          {customer.initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{customer.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{customer.email}</TableCell>
                  <TableCell className="text-muted-foreground">{customer.phone}</TableCell>
                  <TableCell className="text-right font-medium">
                    ${customer.lifetimeSpend.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-center">{customer.ordersCount}</TableCell>
                  <TableCell className="text-muted-foreground">{customer.lastOrderDate}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
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
                        <DropdownMenuItem onClick={() => setSelectedCustomer(customer)}>
                          View profile
                        </DropdownMenuItem>
                        <DropdownMenuItem>Edit customer</DropdownMenuItem>
                        <DropdownMenuItem>Create order</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive">Delete customer</DropdownMenuItem>
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
            Showing <span className="font-medium">{filteredCustomers.length}</span> of{" "}
            <span className="font-medium">{customers.length}</span> customers
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

      {/* Customer Detail Side Panel */}
      <Sheet open={!!selectedCustomer} onOpenChange={() => setSelectedCustomer(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selectedCustomer && (
            <>
              <SheetHeader className="pb-4">
                <div className="flex items-start gap-4">
                  <Avatar className="size-14">
                    <AvatarImage src="" alt={selectedCustomer.name} />
                    <AvatarFallback className="bg-primary/10 text-primary text-lg">
                      {selectedCustomer.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <SheetTitle className="text-xl">{selectedCustomer.name}</SheetTitle>
                    <SheetDescription>Customer since {selectedCustomer.joinedDate}</SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="space-y-6">
                {/* Contact Info */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Contact Information</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="size-4 text-muted-foreground" />
                      <a href={`mailto:${selectedCustomer.email}`} className="text-primary hover:underline">
                        {selectedCustomer.email}
                      </a>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="size-4 text-muted-foreground" />
                      <span>{selectedCustomer.phone}</span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <Card className="py-3">
                    <CardContent className="p-3 text-center">
                      <DollarSign className="size-5 mx-auto text-muted-foreground mb-1" />
                      <p className="text-lg font-semibold">
                        ${selectedCustomer.lifetimeSpend.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </p>
                      <p className="text-xs text-muted-foreground">Lifetime Spend</p>
                    </CardContent>
                  </Card>
                  <Card className="py-3">
                    <CardContent className="p-3 text-center">
                      <ShoppingBag className="size-5 mx-auto text-muted-foreground mb-1" />
                      <p className="text-lg font-semibold">{selectedCustomer.ordersCount}</p>
                      <p className="text-xs text-muted-foreground">Total Orders</p>
                    </CardContent>
                  </Card>
                  <Card className="py-3">
                    <CardContent className="p-3 text-center">
                      <Calendar className="size-5 mx-auto text-muted-foreground mb-1" />
                      <p className="text-lg font-semibold">
                        ${(selectedCustomer.lifetimeSpend / selectedCustomer.ordersCount).toFixed(0)}
                      </p>
                      <p className="text-xs text-muted-foreground">Avg. Order</p>
                    </CardContent>
                  </Card>
                </div>

                <Separator />

                {/* Recent Orders */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Recent Orders</h4>
                  <div className="space-y-2">
                    {selectedCustomer.recentOrders.map((order) => (
                      <div
                        key={order.id}
                        className="flex items-center justify-between rounded-md border p-3"
                      >
                        <div>
                          <p className="font-medium text-sm">{order.id}</p>
                          <p className="text-xs text-muted-foreground">{order.date}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-sm">${order.total.toFixed(2)}</p>
                          <p className={cn("text-xs font-medium", statusColors[order.status])}>
                            {order.status}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4">
                  <Button className="flex-1" variant="outline">
                    Edit Customer
                  </Button>
                  <Button className="flex-1">
                    Create Order
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
