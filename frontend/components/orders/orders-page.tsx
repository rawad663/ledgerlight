"use client";

import * as React from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Download,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Calendar,
  ShoppingCart,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useApiClient } from "@/hooks/use-api";
import { useCursorPagination } from "@/hooks/use-cursor-pagination";
import { useUrlSearch } from "@/hooks/use-url-search";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";

import { type components } from "@/lib/api-types";

type Order = components["schemas"]["OrderListItemDto"];
type LocationDto = components["schemas"]["LocationDto"];

export const ORDERS_PAGE_LIMIT = 50;

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

type Props = {
  orders: Order[];
  total: number;
  nextCursor?: string;
  locations: LocationDto[];
  initialSearch: string;
};

export function OrdersPage({
  orders: initialOrders,
  total: initialTotal,
  nextCursor: initialNextCursor,
  locations,
  initialSearch,
}: Props) {
  const apiClient = useApiClient();
  const { searchParams, searchInput, setSearchInput, updateParams } =
    useUrlSearch(initialSearch);

  const search = searchParams.get("search") ?? "";
  const statusFilter = searchParams.get("status") ?? "all";
  const locationFilter = searchParams.get("location") ?? "all";

  const {
    data: orders,
    total,
    hasNext,
    hasPrevious,
    goNext,
    goPrevious,
    showingFrom,
    showingTo,
    loading,
  } = useCursorPagination<Order>({
    initialData: initialOrders,
    initialTotal,
    initialNextCursor,
    limit: ORDERS_PAGE_LIMIT,
    filterKey: `${search}|${statusFilter}|${locationFilter}`,
    fetchPage: React.useCallback(
      async (cursor?: string) => {
        const { data } = await apiClient.GET("/orders", {
          params: {
            query: {
              limit: ORDERS_PAGE_LIMIT,
              cursor,
              withItems: false,
              search: search || undefined,
              status:
                statusFilter === "all"
                  ? undefined
                  : (statusFilter as OrderStatus),
              locationId: locationFilter === "all" ? undefined : locationFilter,
            },
          },
        });
        return {
          data: data?.data ?? [],
          totalCount: data?.totalCount ?? 0,
          nextCursor: data?.nextCursor ?? undefined,
        };
      },
      [apiClient, search, statusFilter, locationFilter],
    ),
  });

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
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(value) => updateParams({ status: value })}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="CONFIRMED">Confirmed</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
            <SelectItem value="FULFILLED">Fulfilled</SelectItem>
            <SelectItem value="REFUNDED">Refunded</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={locationFilter}
          onValueChange={(value) => updateParams({ location: value })}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Location" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            {locations.map((loc) => (
              <SelectItem key={loc.id} value={loc.id}>
                {loc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" className="shrink-0">
          <Calendar className="size-4" />
          <span className="sr-only">Date range</span>
        </Button>
      </div>

      {/* Orders Table */}
      <div className="rounded-lg border bg-card">
        {orders.length === 0 ? (
          <div className="py-16">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ShoppingCart />
                </EmptyMedia>
                <EmptyTitle>No orders found</EmptyTitle>
                <EmptyDescription>
                  Try adjusting your search or filter criteria.
                </EmptyDescription>
              </EmptyHeader>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchInput("");
                  updateParams({ search: "", status: "", location: "" });
                }}
              >
                Clear filters
              </Button>
            </Empty>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[120px]">Order ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id} className="cursor-pointer group">
                    <TableCell>
                      <Link
                        href={`/orders/${order.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {formatOrderId(order.id)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {order.customer?.name ?? "—"}
                        </p>
                        {order.customer?.email && (
                          <p className="text-xs text-muted-foreground">
                            {order.customer.email}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-medium",
                          statusColors[order.status],
                        )}
                      >
                        {formatStatus(order.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCents(order.totalCents)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {order.location?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(order.createdAt)}
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
                            <Link href={`/orders/${order.id}`}>
                              View details
                            </Link>
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
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Showing{" "}
                <span className="font-medium">
                  {showingFrom}–{showingTo}
                </span>{" "}
                of <span className="font-medium">{total}</span> orders
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasPrevious || loading}
                  onClick={goPrevious}
                >
                  <ChevronLeft className="mr-1 size-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasNext || loading}
                  onClick={goNext}
                >
                  Next
                  <ChevronRight className="ml-1 size-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
