"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Printer,
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  User,
  Mail,
  Phone,
  Package,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface OrderDetailPageProps {
  orderId: string
}

// Mock order data
const orderData = {
  id: "ORD-7821",
  status: "Pending",
  createdAt: "Mar 23, 2026 10:42 AM",
  customer: {
    name: "Emily Parker",
    email: "emily.p@email.com",
    phone: "+1 (555) 123-4567",
  },
  location: {
    name: "Downtown Store",
    address: "123 Main Street, Suite 100",
    city: "San Francisco, CA 94105",
  },
  items: [
    {
      id: "1",
      name: "Classic White T-Shirt",
      sku: "CWT-001-M",
      quantity: 2,
      unitPrice: 29.99,
      discount: 0,
      tax: 5.4,
      total: 65.38,
    },
    {
      id: "2",
      name: "Vintage Denim Jacket",
      sku: "VDJ-042",
      quantity: 1,
      unitPrice: 149.99,
      discount: 15.0,
      tax: 12.15,
      total: 147.14,
    },
    {
      id: "3",
      name: "Canvas Tote Bag - Natural",
      sku: "CTB-015-N",
      quantity: 1,
      unitPrice: 34.99,
      discount: 0,
      tax: 3.15,
      total: 38.14,
    },
  ],
  subtotal: 244.96,
  discount: 15.0,
  tax: 20.7,
  total: 250.66,
  timeline: [
    {
      id: "1",
      action: "Order created",
      description: "Order placed by Emily Parker",
      time: "Mar 23, 2026 10:42 AM",
      icon: Package,
    },
    {
      id: "2",
      action: "Payment pending",
      description: "Awaiting payment confirmation",
      time: "Mar 23, 2026 10:42 AM",
      icon: Clock,
    },
  ],
}

const statusColors: Record<string, string> = {
  Pending: "bg-warning/15 text-warning-foreground border-warning/30",
  Placed: "bg-success/15 text-success border-success/30",
  Cancelled: "bg-destructive/15 text-destructive border-destructive/30",
}

export function OrderDetailPage({ orderId }: OrderDetailPageProps) {
  const order = orderData

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/orders">
              <ArrowLeft className="size-4" />
              <span className="sr-only">Back to orders</span>
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">{order.id}</h1>
              <Badge
                variant="outline"
                className={cn("font-medium", statusColors[order.status])}
              >
                {order.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Created on {order.createdAt}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Printer className="mr-1.5 size-4" />
            Print Receipt
          </Button>
          <Button variant="outline" size="sm">
            <XCircle className="mr-1.5 size-4" />
            Cancel Order
          </Button>
          <Button size="sm">
            <CheckCircle2 className="mr-1.5 size-4" />
            Mark as Placed
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="size-4" />
                <span className="sr-only">More actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Edit order</DropdownMenuItem>
              <DropdownMenuItem>Duplicate order</DropdownMenuItem>
              <DropdownMenuItem>Send invoice</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">Delete order</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Order Items & Pricing */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Order Items</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-6">Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Discount</TableHead>
                    <TableHead className="text-right">Tax</TableHead>
                    <TableHead className="text-right pr-6">Line Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="pl-6 font-medium">{item.name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {item.sku}
                      </TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell className="text-right">${item.unitPrice.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        {item.discount > 0 ? (
                          <span className="text-destructive">-${item.discount.toFixed(2)}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">${item.tax.toFixed(2)}</TableCell>
                      <TableCell className="text-right pr-6 font-medium">
                        ${item.total.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Pricing Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Pricing Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>${order.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="text-destructive">-${order.discount.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span>${order.tax.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between font-medium">
                  <span>Total</span>
                  <span className="text-lg">${order.total.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Customer, Location, Timeline */}
        <div className="space-y-6">
          {/* Customer Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                  <User className="size-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{order.customer.name}</p>
                  <p className="text-xs text-muted-foreground">Customer</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="size-4 text-muted-foreground" />
                  <a href={`mailto:${order.customer.email}`} className="text-primary hover:underline">
                    {order.customer.email}
                  </a>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="size-4 text-muted-foreground" />
                  <span>{order.customer.phone}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Location Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Store Location</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-chart-2/15">
                  <MapPin className="size-5 text-chart-2" />
                </div>
                <div>
                  <p className="font-medium">{order.location.name}</p>
                  <p className="text-xs text-muted-foreground">Point of Sale</p>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                <p>{order.location.address}</p>
                <p>{order.location.city}</p>
              </div>
            </CardContent>
          </Card>

          {/* Activity Timeline */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative space-y-4">
                {order.timeline.map((event, index) => (
                  <div key={event.id} className="relative flex gap-3">
                    {index !== order.timeline.length - 1 && (
                      <div className="absolute left-[15px] top-8 h-[calc(100%-8px)] w-px bg-border" />
                    )}
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                      <event.icon className="size-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 pt-0.5">
                      <p className="text-sm font-medium">{event.action}</p>
                      <p className="text-xs text-muted-foreground">{event.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">{event.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
