"use client";

import {
  Calendar,
  DollarSign,
  Download,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
  ShoppingBag,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { CreateCustomerForm } from "@/components/customers/create-customer-form";
import { DeleteCustomerDialog } from "@/components/customers/delete-customer-dialog";
import { EditCustomerForm } from "@/components/customers/edit-customer-form";
import { CreateOrderForm } from "@/components/orders/create-order-form";
import { PageHeader } from "@/components/shared/page-header";
import { PageSearchInput } from "@/components/shared/page-search-input";
import { PaginationFooter } from "@/components/shared/pagination-footer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { components } from "@/lib/api-types";
import {
  formatCurrencyCents,
  formatEnumLabel,
  formatOrderId,
  formatShortDate,
  getInitials,
} from "@/lib/formatters";
import { ORDER_STATUS_TEXT_STYLES } from "@/lib/status";
import { cn } from "@/lib/utils";

type CustomerListItem = components["schemas"]["CustomerListItemDto"];
type CustomerDetail = components["schemas"]["CustomerDetailDto"];

export const CUSTOMERS_PAGE_LIMIT = 50;

type CustomersPageProps = {
  customers: CustomerListItem[];
  total: number;
  nextCursor?: string;
  initialSearch: string;
};

export function CustomersPage({
  customers: initialCustomers,
  total: initialTotal,
  nextCursor: initialNextCursor,
  initialSearch,
}: CustomersPageProps) {
  const apiClient = useApiClient();
  const router = useRouter();
  const { searchParams, searchInput, setSearchInput } =
    useUrlSearch(initialSearch);

  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [isCreateOrderFormOpen, setIsCreateOrderFormOpen] = useState(false);
  const [customerBeingEdited, setCustomerBeingEdited] =
    useState<CustomerDetail | null>(null);
  const [customerBeingDeleted, setCustomerBeingDeleted] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerDetail | null>(null);
  const [isDetailsPanelLoading, setIsDetailsPanelLoading] = useState(false);
  const [orderCustomerDefaults, setOrderCustomerDefaults] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const search = searchParams.get("search") ?? "";

  const {
    data: customers,
    total,
    hasNext,
    hasPrevious,
    refresh,
    goNext,
    goPrevious,
    showingFrom,
    showingTo,
    loading,
  } = useCursorPagination<CustomerListItem>({
    initialData: initialCustomers,
    initialTotal,
    initialNextCursor,
    limit: CUSTOMERS_PAGE_LIMIT,
    filterKey: search,
    fetchPage: useCallback(
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

  async function handleSelectCustomer(customerId: string) {
    setIsDetailsPanelLoading(true);
    const { data } = await apiClient.GET("/customers/{id}", {
      params: { path: { id: customerId } },
    });

    if (data) {
      setSelectedCustomer(data);
    }

    setIsDetailsPanelLoading(false);
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Customers"
        description="View and manage your customer database."
        actions={
          <>
            <Button variant="outline" size="sm">
              <Download className="mr-1.5 size-4" />
              Export
            </Button>
            <Button size="sm" onClick={() => setIsCreateFormOpen(true)}>
              <Plus className="mr-1.5 size-4" />
              Add Customer
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <PageSearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Search by name, email, or phone..."
        />
      </div>

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
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-muted-foreground">No customers found</p>
                    {search ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSearchInput("")}
                      >
                        Clear search
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              customers.map((customer) => (
                <TableRow
                  key={customer.id}
                  className="group cursor-pointer"
                  onClick={() => handleSelectCustomer(customer.id)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-9">
                        <AvatarImage src="" alt={customer.name} />
                        <AvatarFallback className="bg-primary/10 text-sm text-primary">
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
                    {customer.status ? formatEnumLabel(customer.status) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrencyCents(customer.lifetimeSpendCents)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatCurrencyCents(customer.avgOrderValueCents)}
                  </TableCell>
                  <TableCell className="text-center">
                    {customer.ordersCount}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {customer.lastOrderDate
                      ? formatShortDate(customer.lastOrderDate)
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        asChild
                        onClick={(event) => event.stopPropagation()}
                      >
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
                        <DropdownMenuItem
                          onClick={() => handleSelectCustomer(customer.id)}
                        >
                          View profile
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={async (event) => {
                            event.stopPropagation();

                            const { data } = await apiClient.GET(
                              "/customers/{id}",
                              {
                                params: { path: { id: customer.id } },
                              },
                            );

                            if (data) {
                              setCustomerBeingEdited(data);
                            }
                          }}
                        >
                          Edit customer
                        </DropdownMenuItem>
                        {customer.status === "ACTIVE" ? (
                          <DropdownMenuItem
                            onClick={(event) => {
                              event.stopPropagation();
                              setOrderCustomerDefaults({
                                id: customer.id,
                                name: customer.name,
                              });
                              setIsCreateOrderFormOpen(true);
                            }}
                          >
                            Create order
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={(event) => {
                            event.stopPropagation();
                            setCustomerBeingDeleted({
                              id: customer.id,
                              name: customer.name,
                            });
                          }}
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

        <PaginationFooter
          itemLabel="customers"
          total={total}
          showingFrom={showingFrom}
          showingTo={showingTo}
          hasPrevious={hasPrevious}
          hasNext={hasNext}
          loading={loading}
          onPrevious={goPrevious}
          onNext={goNext}
        />
      </div>

      <Sheet
        open={!!selectedCustomer}
        onOpenChange={() => setSelectedCustomer(null)}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {selectedCustomer && !isDetailsPanelLoading ? (
            <>
              <SheetHeader className="pb-4">
                <div className="flex items-start gap-4">
                  <Avatar className="size-14">
                    <AvatarImage src="" alt={selectedCustomer.name} />
                    <AvatarFallback className="bg-primary/10 text-lg text-primary">
                      {getInitials(selectedCustomer.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <SheetTitle className="text-xl">
                      {selectedCustomer.name}
                    </SheetTitle>
                    <SheetDescription>
                      Customer since{" "}
                      {formatShortDate(selectedCustomer.createdAt)}
                      <br /> - {formatEnumLabel(selectedCustomer.status)}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="space-y-6">
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
                    {selectedCustomer.phone ? (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="size-4 text-muted-foreground" />
                        <span>{selectedCustomer.phone}</span>
                      </div>
                    ) : null}
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-3 gap-4">
                  <Card className="py-3">
                    <CardContent className="p-3 text-center">
                      <DollarSign className="mx-auto mb-1 size-5 text-muted-foreground" />
                      <p className="text-lg font-semibold">
                        {formatCurrencyCents(
                          selectedCustomer.lifetimeSpendCents,
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Lifetime Spend
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="py-3">
                    <CardContent className="p-3 text-center">
                      <ShoppingBag className="mx-auto mb-1 size-5 text-muted-foreground" />
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
                      <Calendar className="mx-auto mb-1 size-5 text-muted-foreground" />
                      <p className="text-lg font-semibold">
                        {formatCurrencyCents(
                          selectedCustomer.avgOrderValueCents,
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Avg. Order
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Separator />

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
                            <p className="text-sm font-medium">
                              {formatOrderId(order.id)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatShortDate(order.createdAt)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">
                              {formatCurrencyCents(order.totalCents)}
                            </p>
                            <p
                              className={cn(
                                "text-xs font-medium",
                                ORDER_STATUS_TEXT_STYLES[order.status],
                              )}
                            >
                              {formatEnumLabel(order.status)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      No orders yet.
                    </p>
                  )}
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    className="flex-1"
                    variant="outline"
                    onClick={() => {
                      setCustomerBeingEdited(selectedCustomer);
                      setSelectedCustomer(null);
                    }}
                  >
                    Edit Customer
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={selectedCustomer.status !== "ACTIVE"}
                    onClick={() => {
                      setOrderCustomerDefaults({
                        id: selectedCustomer.id,
                        name: selectedCustomer.name,
                      });
                      setSelectedCustomer(null);
                      setIsCreateOrderFormOpen(true);
                    }}
                  >
                    Create Order
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <CreateCustomerForm
        open={isCreateFormOpen}
        onOpenChange={setIsCreateFormOpen}
        onSuccess={() => {
          toast({ title: "Customer added" });
          refresh();
        }}
      />

      <CreateOrderForm
        open={isCreateOrderFormOpen}
        onOpenChange={setIsCreateOrderFormOpen}
        defaultCustomerId={orderCustomerDefaults?.id}
        defaultCustomerName={orderCustomerDefaults?.name}
        onSuccess={(orderId) => router.push(`/orders/${orderId}`)}
      />

      <EditCustomerForm
        open={!!customerBeingEdited}
        onOpenChange={(open) => {
          if (!open) {
            setCustomerBeingEdited(null);
          }
        }}
        customer={customerBeingEdited}
        onSuccess={() => {
          toast({ title: "Customer updated" });
          refresh();
        }}
      />

      <DeleteCustomerDialog
        open={!!customerBeingDeleted}
        onOpenChange={(open) => {
          if (!open) {
            setCustomerBeingDeleted(null);
          }
        }}
        customer={customerBeingDeleted}
        onSuccess={() => {
          toast({ title: "Customer deleted" });
          refresh();
        }}
      />
    </div>
  );
}
