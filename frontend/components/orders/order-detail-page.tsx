"use client";

import * as React from "react";
import Link from "next/link";
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
  Package,
  Edit,
  Trash2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { components } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type OrderDetail = components["schemas"]["OrderDetailDto"];
type AuditLog = components["schemas"]["AuditLogDto"];

interface OrderDetailPageProps {
  order: OrderDetail;
  auditLogs: AuditLog[];
}

const statusColors: Record<string, string> = {
  PENDING: "bg-warning/15 text-warning-foreground border-warning/30",
  CONFIRMED: "bg-success/15 text-success border-success/30",
  CANCELLED: "bg-destructive/15 text-destructive border-destructive/30",
  FULFILLED: "bg-primary/15 text-primary border-primary/30",
  REFUNDED: "bg-muted text-muted-foreground border-muted",
};

function formatStatus(status: string): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function formatOrderId(uuid: string): string {
  return `ORD-${uuid.substring(0, 8).toUpperCase()}`;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

const actionLabels: Record<string, string> = {
  CREATE: "Created",
  UPDATE: "Updated",
  DELETE: "Deleted",
  STATUS_CHANGE: "Status changed",
  INVENTORY_ADJUST: "Inventory adjusted",
  LOGIN: "Login",
  LOGOUT: "Logout",
};

const actionIcons: Record<string, React.ElementType> = {
  CREATE: Package,
  UPDATE: Edit,
  DELETE: Trash2,
  STATUS_CHANGE: RefreshCw,
  INVENTORY_ADJUST: Package,
  LOGIN: ShieldCheck,
  LOGOUT: ShieldCheck,
};

function getActorName(actor: AuditLog["actor"]): string {
  if (!actor) return "System";
  const parts = [actor.firstName, actor.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : actor.email;
}

export function OrderDetailPage({ order, auditLogs }: OrderDetailPageProps) {
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
              <h1 className="text-2xl font-semibold tracking-tight">
                {formatOrderId(order.id)}
              </h1>
              <Badge
                variant="outline"
                className={cn("font-medium", statusColors[order.status])}
              >
                {formatStatus(order.status)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Created on {formatDate(order.createdAt)}
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
              <DropdownMenuItem className="text-destructive">
                Delete order
              </DropdownMenuItem>
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
              {order.items && order.items.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-6">Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Discount</TableHead>
                      <TableHead className="text-right">Tax</TableHead>
                      <TableHead className="text-right pr-6">
                        Line Total
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="pl-6 font-medium">
                          {item.productName}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {item.sku ?? "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          {item.qty}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCents(item.unitPriceCents)}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.discountCents > 0 ? (
                            <span className="text-destructive">
                              -{formatCents(item.discountCents)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCents(item.taxCents)}
                        </TableCell>
                        <TableCell className="text-right pr-6 font-medium">
                          {formatCents(item.lineTotalCents)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No items in this order.
                </div>
              )}
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
                  <span>{formatCents(order.subtotalCents)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="text-destructive">
                    -{formatCents(order.discountCents)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span>{formatCents(order.taxCents)}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between font-medium">
                  <span>Total</span>
                  <span className="text-lg">
                    {formatCents(order.totalCents)}
                  </span>
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
              {order.customer ? (
                <>
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
                      <a
                        href={`mailto:${order.customer.email}`}
                        className="text-primary hover:underline"
                      >
                        {order.customer.email}
                      </a>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                    <User className="size-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    No customer assigned
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Location Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Store Location</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {order.location ? (
                <>
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-full bg-chart-2/15">
                      <MapPin className="size-5 text-chart-2" />
                    </div>
                    <div>
                      <p className="font-medium">{order.location.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Point of Sale
                      </p>
                    </div>
                  </div>
                  {(order.location.address || order.location.city) && (
                    <div className="text-sm text-muted-foreground">
                      {order.location.address && (
                        <p>{order.location.address}</p>
                      )}
                      {order.location.city && <p>{order.location.city}</p>}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                    <MapPin className="size-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    No location assigned
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity Timeline */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {auditLogs.length > 0 ? (
                <div className="relative space-y-4">
                  {auditLogs.map((log, index) => {
                    const Icon = actionIcons[log.action] ?? Clock;
                    return (
                      <div key={log.id} className="relative flex gap-3">
                        {index !== auditLogs.length - 1 && (
                          <div className="absolute left-[15px] top-8 h-[calc(100%-8px)] w-px bg-border" />
                        )}
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                          <Icon className="size-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 pt-0.5">
                          <p className="text-sm font-medium">
                            {actionLabels[log.action] ?? log.action}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            by {getActorName(log.actor)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDate(log.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No activity recorded yet.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
