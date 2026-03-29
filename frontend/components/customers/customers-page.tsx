"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Download,
  Plus,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  ShoppingBag,
  DollarSign,
  Calendar,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { components } from "@/lib/api-types";
import { useApiClient } from "@/hooks/use-api";
import { useUrlSearch } from "@/hooks/use-url-search";
import { toast } from "@/hooks/use-toast";
import { useCursorPagination } from "@/hooks/use-cursor-pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { CreateCustomerForm } from "@/components/customers/create-customer-form";
import { EditCustomerForm } from "@/components/customers/edit-customer-form";
import { DeleteCustomerDialog } from "@/components/customers/delete-customer-dialog";
import { CreateOrderForm } from "@/components/orders/create-order-form";

type Customer = components["schemas"]["CustomerListItemDto"];
type CustomerDetail = components["schemas"]["CustomerDetailDto"];

export const CUSTOMERS_PAGE_LIMIT = 50;

const statusColors: Record<string, string> = {
  PENDING: "text-warning-foreground",
  CONFIRMED: "text-success",
  CANCELLED: "text-destructive",
  FULFILLED: "text-primary",
  REFUNDED: "text-muted-foreground",
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatStatus(status: string): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatOrderId(uuid: string): string {
  return `ORD-${uuid.substring(0, 8).toUpperCase()}`;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

type Props = {
  customers: Customer[];
  total: number;
  nextCursor?: string;
  initialSearch: string;
};

export function CustomersPage({
  customers: initialCustomers,
  total: initialTotal,
  nextCursor: initialNextCursor,
  initialSearch,
}: Props) {
  const apiClient = useApiClient();
  const router = useRouter();
  const { searchParams, searchInput, setSearchInput } =
    useUrlSearch(initialSearch);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createOrderOpen, setCreateOrderOpen] = React.useState(false);
  const [editCustomer, setEditCustomer] = React.useState<CustomerDetail | null>(
    null,
  );
  const [deleteCustomer, setDeleteCustomer] = React.useState<{
    id: string;
    name: string;
  } | null>(null);

  const search = searchParams.get("search") ?? "";

  const {
    data: customers,
    total,
    hasNext,
    hasPrevious,
    goNext,
    goPrevious,
    showingFrom,
    showingTo,
    loading,
  } = useCursorPagination<Customer>({
    initialData: initialCustomers,
    initialTotal,
    initialNextCursor,
    limit: CUSTOMERS_PAGE_LIMIT,
    filterKey: search,
    fetchPage: React.useCallback(
      async (cursor?: string) => {
        const { data } = await apiClient.GET("/customers", {
          params: {
            query: {
              limit: CUSTOMERS_PAGE_LIMIT,
              cursor,
              search: search || undefined,
              sortBy: "updatedAt",
              sortOrder: "desc",
            },
          },
        });
        return {
          data: data?.data ?? [],
          totalCount: data?.totalCount ?? 0,
          nextCursor: data?.nextCursor ?? undefined,
        };
      },
      [apiClient, search],
    ),
  });

  const [selectedCustomer, setSelectedCustomer] =
    React.useState<CustomerDetail | null>(null);
  const [panelLoading, setPanelLoading] = React.useState(false);
  const [orderCustomer, setOrderCustomer] = React.useState<{
    id: string;
    name: string;
  } | null>(null);

  async function handleSelectCustomer(id: string) {
    setPanelLoading(true);
    const { data } = await apiClient.GET("/customers/{id}", {
      params: { path: { id } },
    });
    if (data) {
      setSelectedCustomer(data);
    }
    setPanelLoading(false);
  }

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
          <Button size="sm" onClick={() => setCreateOpen(true)}>
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
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Customers Table */}
      <div className={cn("rounded-lg border bg-card", loading && "opacity-60")}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[250px]">Customer</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Lifetime Spend</TableHead>
              <TableHead className="text-right">Avg. Order</TableHead>
              <TableHead className="text-center">Orders</TableHead>
              <TableHead>Last Order</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-muted-foreground">No customers found</p>
                    {search && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSearchInput("")}
                      >
                        Clear search
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              customers.map((customer) => (
                <TableRow
                  key={customer.id}
                  className="cursor-pointer group"
                  onClick={() => handleSelectCustomer(customer.id)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-9">
                        <AvatarImage src="" alt={customer.name} />
                        <AvatarFallback className="bg-primary/10 text-primary text-sm">
                          {getInitials(customer.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{customer.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {customer.email}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {customer.phone ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {customer.status ?? "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCents(customer.lifetimeSpendCents)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatCents(customer.avgOrderValueCents)}
                  </TableCell>
                  <TableCell className="text-center">
                    {customer.ordersCount}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {customer.lastOrderDate
                      ? formatDate(customer.lastOrderDate)
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        asChild
                        onClick={(e) => e.stopPropagation()}
                      >
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
                        <DropdownMenuItem
                          onClick={() => handleSelectCustomer(customer.id)}
                        >
                          View profile
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={async (e) => {
                            e.stopPropagation();

                            const { data } = await apiClient.GET(
                              "/customers/{id}",
                              { params: { path: { id: customer.id } } },
                            );
                            if (data) setEditCustomer(data);
                          }}
                        >
                          Edit customer
                        </DropdownMenuItem>
                        {customer.status === "ACTIVE" && (
                          <DropdownMenuItem
                            onClick={(e) => e.stopPropagation()}
                          >
                            Create order
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() =>
                            setDeleteCustomer({
                              id: customer.id,
                              name: customer.name,
                            })
                          }
                        >
                          Delete customer
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
            Showing{" "}
            <span className="font-medium">
              {total === 0 ? 0 : showingFrom}–{showingTo}
            </span>{" "}
            of <span className="font-medium">{total}</span> customers
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
      </div>

      {/* Customer Detail Side Panel */}
      <Sheet
        open={!!selectedCustomer}
        onOpenChange={() => setSelectedCustomer(null)}
      >
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selectedCustomer && !panelLoading && (
            <>
              <SheetHeader className="pb-4">
                <div className="flex items-start gap-4">
                  <Avatar className="size-14">
                    <AvatarImage src="" alt={selectedCustomer.name} />
                    <AvatarFallback className="bg-primary/10 text-primary text-lg">
                      {getInitials(selectedCustomer.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <SheetTitle className="text-xl">
                      {selectedCustomer.name}
                    </SheetTitle>
                    <SheetDescription>
                      Customer since {formatDate(selectedCustomer.createdAt)}
                      <br /> - {selectedCustomer.status}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="space-y-6">
                {/* Contact Info */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Contact Information
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="size-4 text-muted-foreground" />
                      <a
                        href={`mailto:${selectedCustomer.email}`}
                        className="text-primary hover:underline"
                      >
                        {selectedCustomer.email}
                      </a>
                    </div>
                    {selectedCustomer.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="size-4 text-muted-foreground" />
                        <span>{selectedCustomer.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <Card className="py-3">
                    <CardContent className="p-3 text-center">
                      <DollarSign className="size-5 mx-auto text-muted-foreground mb-1" />
                      <p className="text-lg font-semibold">
                        {formatCents(selectedCustomer.lifetimeSpendCents)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Lifetime Spend
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="py-3">
                    <CardContent className="p-3 text-center">
                      <ShoppingBag className="size-5 mx-auto text-muted-foreground mb-1" />
                      <p className="text-lg font-semibold">
                        {selectedCustomer.ordersCount}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Total Orders
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="py-3">
                    <CardContent className="p-3 text-center">
                      <Calendar className="size-5 mx-auto text-muted-foreground mb-1" />
                      <p className="text-lg font-semibold">
                        {formatCents(selectedCustomer.avgOrderValueCents)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Avg. Order
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Separator />

                {/* Recent Orders */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Recent Orders
                  </h4>
                  {selectedCustomer.recentOrders.length > 0 ? (
                    <div className="space-y-2">
                      {selectedCustomer.recentOrders.map((order) => (
                        <div
                          key={order.id}
                          className="flex items-center justify-between rounded-md border p-3"
                        >
                          <div>
                            <p className="font-medium text-sm">
                              {formatOrderId(order.id)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(order.createdAt)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-sm">
                              {formatCents(order.totalCents)}
                            </p>
                            <p
                              className={cn(
                                "text-xs font-medium",
                                statusColors[order.status],
                              )}
                            >
                              {formatStatus(order.status)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No orders yet.
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4">
                  <Button
                    className="flex-1"
                    variant="outline"
                    onClick={() => {
                      setEditCustomer(selectedCustomer);
                      setSelectedCustomer(null);
                    }}
                  >
                    Edit Customer
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={selectedCustomer.status !== "ACTIVE"}
                    onClick={() => {
                      setOrderCustomer({
                        id: selectedCustomer.id,
                        name: selectedCustomer.name,
                      });
                      setSelectedCustomer(null);
                      setCreateOrderOpen(true);
                    }}
                  >
                    Create Order
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <CreateCustomerForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={() => {
          toast({ title: "Customer added" });
          router.refresh();
        }}
      />

      <CreateOrderForm
        open={createOrderOpen}
        onOpenChange={setCreateOrderOpen}
        defaultCustomerId={orderCustomer?.id}
        defaultCustomerName={orderCustomer?.name}
        onSuccess={(orderId) => router.push(`/orders/${orderId}`)}
      />

      <EditCustomerForm
        open={!!editCustomer}
        onOpenChange={(open) => {
          if (!open) setEditCustomer(null);
        }}
        customer={editCustomer}
        onSuccess={() => {
          toast({ title: "Customer updated" });
          router.refresh();
        }}
      />

      <DeleteCustomerDialog
        open={!!deleteCustomer}
        onOpenChange={(open) => {
          if (!open) setDeleteCustomer(null);
        }}
        customer={deleteCustomer}
        onSuccess={() => {
          toast({ title: "Customer deleted" });
          router.refresh();
        }}
      />
    </div>
  );
}
