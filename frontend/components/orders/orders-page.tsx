"use client";

import { Download, MoreHorizontal, Plus, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { CancelOrderDialog } from "@/components/orders/cancel-order-dialog";
import { CreateOrderForm } from "@/components/orders/create-order-form";
import { EditOrderForm } from "@/components/orders/edit-order-form";
import { PageHeader } from "@/components/shared/page-header";
import { PageSearchInput } from "@/components/shared/page-search-input";
import { PaginationFooter } from "@/components/shared/pagination-footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
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
import { useApiClient } from "@/hooks/use-api";
import { useCursorPagination } from "@/hooks/use-cursor-pagination";
import { toast } from "@/hooks/use-toast";
import { useUrlSearch } from "@/hooks/use-url-search";
import { type components } from "@/lib/api-types";
import {
  formatCurrencyCents,
  formatDateTime,
  formatEnumLabel,
  formatOrderId,
} from "@/lib/formatters";
import { ORDER_STATUS_STYLES, type OrderStatus } from "@/lib/status";
import { cn } from "@/lib/utils";

type OrderListItem = components["schemas"]["OrderListItemDto"];
type OrderLocationOption = {
  id: string;
  name: string;
};

export const ORDERS_PAGE_LIMIT = 50;

type OrdersPageProps = {
  orders: OrderListItem[];
  total: number;
  nextCursor?: string;
  locations: OrderLocationOption[];
  initialSearch: string;
};

export function OrdersPage({
  orders: initialOrders,
  total: initialTotal,
  nextCursor: initialNextCursor,
  locations,
  initialSearch,
}: OrdersPageProps) {
  const apiClient = useApiClient();
  const router = useRouter();
  const { searchParams, searchInput, setSearchInput, updateParams } =
    useUrlSearch(initialSearch);
  const [isCreateFormOpen, setIsCreateFormOpen] = React.useState(false);
  const [orderBeingCancelled, setOrderBeingCancelled] = React.useState<{
    id: string;
  } | null>(null);
  const [orderBeingEdited, setOrderBeingEdited] =
    React.useState<OrderListItem | null>(null);

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
    refresh,
    showingFrom,
    showingTo,
    loading,
  } = useCursorPagination<OrderListItem>({
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
              sortBy: "createdAt",
              sortOrder: "desc",
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
    <div className="space-y-6 p-6">
      <PageHeader
        title="Orders"
        description="Manage and track all customer orders across locations."
        actions={
          <>
            <Button variant="outline" size="sm">
              <Download className="mr-1.5 size-4" />
              Export
            </Button>
            <Button size="sm" onClick={() => setIsCreateFormOpen(true)}>
              <Plus className="mr-1.5 size-4" />
              Create Order
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <PageSearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Search by order ID or customer..."
        />
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
            {locations.map((location) => (
              <SelectItem key={location.id} value={location.id}>
                {location.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className={cn("rounded-lg border bg-card", loading && "opacity-60")}>
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
              <EmptyContent>
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
              </EmptyContent>
            </Empty>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id} className="group cursor-pointer">
                    <TableCell className="font-medium">
                      <Link
                        href={`/orders/${order.id}`}
                        className="hover:text-primary"
                      >
                        {formatOrderId(order.id)}
                      </Link>
                    </TableCell>
                    <TableCell>{order.customer?.name ?? "Walk-in customer"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {order.location?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-medium",
                          ORDER_STATUS_STYLES[order.status],
                        )}
                      >
                        {formatEnumLabel(order.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrencyCents(order.totalCents)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(order.createdAt)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-0 transition-opacity group-hover:opacity-100"
                          >
                            <MoreHorizontal className="size-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/orders/${order.id}`}>View details</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setOrderBeingEdited(order)}
                          >
                            Edit order
                          </DropdownMenuItem>
                          {order.status === "PENDING" ||
                          order.status === "CONFIRMED" ? (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() =>
                                  setOrderBeingCancelled({ id: order.id })
                                }
                              >
                                Cancel order
                              </DropdownMenuItem>
                            </>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <PaginationFooter
              itemLabel="orders"
              total={total}
              showingFrom={showingFrom}
              showingTo={showingTo}
              hasPrevious={hasPrevious}
              hasNext={hasNext}
              loading={loading}
              onPrevious={goPrevious}
              onNext={goNext}
            />
          </>
        )}
      </div>

      <CreateOrderForm
        open={isCreateFormOpen}
        onOpenChange={setIsCreateFormOpen}
        onSuccess={(orderId) => {
          toast({ title: "Order created" });
          router.push(`/orders/${orderId}`);
        }}
      />

      <CancelOrderDialog
        open={!!orderBeingCancelled}
        onOpenChange={(open) => {
          if (!open) {
            setOrderBeingCancelled(null);
          }
        }}
        order={orderBeingCancelled}
        onSuccess={() => {
          toast({ title: "Order cancelled" });
          void refresh();
        }}
      />

      <EditOrderForm
        open={!!orderBeingEdited}
        onOpenChange={(open) => {
          if (!open) {
            setOrderBeingEdited(null);
          }
        }}
        order={orderBeingEdited}
        locations={locations}
        onSuccess={() => {
          toast({ title: "Order updated" });
          void refresh();
        }}
      />
    </div>
  );
}
