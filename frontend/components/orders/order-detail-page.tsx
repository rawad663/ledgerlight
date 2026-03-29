"use client";

import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Edit,
  Loader2,
  Mail,
  MapPin,
  MoreHorizontal,
  Package,
  Plus,
  Printer,
  RefreshCw,
  ShieldCheck,
  Trash2,
  User,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { CancelOrderDialog } from "@/components/orders/cancel-order-dialog";
import { EditOrderForm } from "@/components/orders/edit-order-form";
import { OrderProductCombobox } from "@/components/orders/order-product-combobox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiClient } from "@/hooks/use-api";
import { toast } from "@/hooks/use-toast";
import { components } from "@/lib/api-types";
import {
  dollarsToCents,
  formatCurrencyCents,
  formatDateTime,
  formatEnumLabel,
  formatOrderId,
} from "@/lib/formatters";
import { ORDER_STATUS_STYLES } from "@/lib/status";
import { cn } from "@/lib/utils";

type OrderDetail = components["schemas"]["OrderDetailDto"];
type AuditLog = components["schemas"]["AuditLogDto"];
type OrderStatus = components["schemas"]["OrderDto"]["status"];

interface OrderDetailPageProps {
  order: OrderDetail;
  auditLogs: AuditLog[];
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

const transitionActions: Record<
  OrderStatus,
  Array<{
    toStatus: OrderStatus;
    label: string;
    icon: React.ElementType;
    variant: "default" | "outline" | "destructive";
    requiresConfirmation: boolean;
  }>
> = {
  PENDING: [
    {
      toStatus: "CONFIRMED",
      label: "Confirm Order",
      icon: CheckCircle2,
      variant: "default",
      requiresConfirmation: false,
    },
    {
      toStatus: "CANCELLED",
      label: "Cancel Order",
      icon: XCircle,
      variant: "destructive",
      requiresConfirmation: true,
    },
  ],
  CONFIRMED: [
    {
      toStatus: "FULFILLED",
      label: "Fulfill Order",
      icon: CheckCircle2,
      variant: "default",
      requiresConfirmation: false,
    },
    {
      toStatus: "CANCELLED",
      label: "Cancel Order",
      icon: XCircle,
      variant: "destructive",
      requiresConfirmation: true,
    },
  ],
  CANCELLED: [
    {
      toStatus: "PENDING",
      label: "Reopen Order",
      icon: RefreshCw,
      variant: "outline",
      requiresConfirmation: true,
    },
  ],
  FULFILLED: [
    {
      toStatus: "REFUNDED",
      label: "Refund Order",
      icon: RefreshCw,
      variant: "destructive",
      requiresConfirmation: true,
    },
  ],
  REFUNDED: [],
};

export function OrderDetailPage({ order, auditLogs }: OrderDetailPageProps) {
  const router = useRouter();
  const apiClient = useApiClient();
  const [currentOrder, setCurrentOrder] = React.useState(order);
  const [showAddItemForm, setShowAddItemForm] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submittingItem, setSubmittingItem] = React.useState(false);
  const [transitioningTo, setTransitioningTo] =
    React.useState<OrderStatus | null>(null);
  const [showCancelOrderDialog, setShowCancelOrderDialog] =
    React.useState(false);
  const [showEditOrderForm, setShowEditOrderForm] = React.useState(false);
  const [confirmTransition, setConfirmTransition] = React.useState<{
    toStatus: OrderStatus;
    label: string;
  } | null>(null);
  const [removingItemId, setRemovingItemId] = React.useState<string | null>(
    null,
  );
  const [newItem, setNewItem] = React.useState({
    productId: "",
    productName: "",
    sku: "",
    unitPriceCents: 0,
    qty: 1,
    discountDollars: "",
    taxDollars: "",
  });

  React.useEffect(() => {
    setCurrentOrder(order);
  }, [order]);

  const isPending = currentOrder.status === "PENDING";
  const canRemoveItems = isPending && (currentOrder.items?.length ?? 0) > 1;
  const availableTransitions = transitionActions[currentOrder.status] ?? [];

  function resetNewItemForm() {
    setNewItem({
      productId: "",
      productName: "",
      sku: "",
      unitPriceCents: 0,
      qty: 1,
      discountDollars: "",
      taxDollars: "",
    });
    setSubmitError(null);
  }

  function lineSubtotal() {
    return newItem.qty * newItem.unitPriceCents;
  }

  function lineDiscount() {
    return dollarsToCents(newItem.discountDollars);
  }

  function lineTax() {
    return dollarsToCents(newItem.taxDollars);
  }

  function lineTotal() {
    return lineSubtotal() - lineDiscount() + lineTax();
  }

  function validateNewItem(): string | null {
    if (!newItem.productId) return "Select a product to add.";
    if (newItem.qty < 1) return "Quantity must be at least 1.";
    if (
      currentOrder.items?.some((item) => item.productId === newItem.productId)
    ) {
      return "This product is already on the order.";
    }
    if (lineDiscount() > lineSubtotal()) {
      return "Discount cannot exceed the line subtotal.";
    }
    return null;
  }

  async function handleAddItem() {
    const validationError = validateNewItem();
    if (validationError) {
      setSubmitError(validationError);
      return;
    }

    setSubmittingItem(true);
    setSubmitError(null);

    const body: components["schemas"]["CreateOrderItemDto"] = {
      productId: newItem.productId,
      qty: newItem.qty,
      discountCents: lineDiscount(),
      taxCents: lineTax(),
    };

    const { data, error } = await apiClient.POST("/orders/{id}/items", {
      params: { path: { id: currentOrder.id } },
      body,
    });

    setSubmittingItem(false);

    if (error) {
      const message = (error as Error)?.message ?? "Failed to add item";
      setSubmitError(message);
      toast({
        title: "Could not add item",
        description: message,
        variant: "destructive",
      });
      return;
    }

    if (data) {
      setCurrentOrder((prev) => ({
        ...prev,
        ...data,
        customer: prev.customer,
        location: prev.location,
      }));
      setShowAddItemForm(false);
      resetNewItemForm();
      toast({ title: "Item added to order" });
    }
  }

  async function handleRemoveItem(itemId: string) {
    if ((currentOrder.items?.length ?? 0) <= 1) {
      const message = "Orders must keep at least one item.";
      setSubmitError(message);
      toast({
        title: "Could not remove item",
        description: message,
        variant: "destructive",
      });
      return;
    }

    setRemovingItemId(itemId);
    setSubmitError(null);

    const { data, error } = await apiClient.DELETE(
      "/orders/{id}/items/{itemId}",
      {
        params: { path: { id: currentOrder.id, itemId } },
      },
    );

    setRemovingItemId(null);

    if (error) {
      const message = (error as Error)?.message ?? "Failed to remove item";
      setSubmitError(message);
      toast({
        title: "Could not remove item",
        description: message,
        variant: "destructive",
      });
      return;
    }

    if (data) {
      setCurrentOrder((prev) => ({
        ...prev,
        ...data,
        customer: prev.customer,
        location: prev.location,
      }));
      toast({ title: "Item removed from order" });
    }
  }

  async function performTransition(toStatus: OrderStatus) {
    setTransitioningTo(toStatus);
    setSubmitError(null);

    const { data, error } = await apiClient.POST(
      "/orders/{id}/transition-status",
      {
        params: { path: { id: currentOrder.id } },
        body: { toStatus },
      },
    );

    setTransitioningTo(null);
    setConfirmTransition(null);

    if (error) {
      const message = (error as Error)?.message ?? "Failed to update status";
      setSubmitError(message);
      toast({
        title: "Could not update order",
        description: message,
        variant: "destructive",
      });
      return;
    }

    if (data) {
      setCurrentOrder((prev) => ({
        ...prev,
        ...data,
      }));
      toast({ title: `Order marked as ${formatEnumLabel(data.status)}` });
      router.refresh();
    }
  }

  function handleTransitionAction(action: {
    toStatus: OrderStatus;
    label: string;
    requiresConfirmation: boolean;
  }) {
    if (action.toStatus === "CANCELLED") {
      setShowCancelOrderDialog(true);
      return;
    }

    if (action.requiresConfirmation) {
      setConfirmTransition({
        toStatus: action.toStatus,
        label: action.label,
      });
      return;
    }

    void performTransition(action.toStatus);
  }

  function getTransitionDescription() {
    if (!confirmTransition) return "";

    if (confirmTransition.toStatus === "REFUNDED") {
      return "This will mark the order as refunded. Make sure any financial refund has been handled before continuing.";
    }

    return "This will reopen the order and move it back to pending so it can be edited and processed again.";
  }

  return (
    <>
      <CancelOrderDialog
        open={showCancelOrderDialog}
        onOpenChange={setShowCancelOrderDialog}
        order={{ id: currentOrder.id }}
        onSuccess={() => {
          toast({ title: "Order cancelled" });
          router.refresh();
        }}
      />
      <EditOrderForm
        open={showEditOrderForm}
        onOpenChange={setShowEditOrderForm}
        order={currentOrder}
        onSuccess={({ customer, location }) => {
          setCurrentOrder((prev) => ({
            ...prev,
            customerId: customer?.id ?? null,
            locationId: location?.id ?? null,
            customer,
            location,
          }));
          toast({ title: "Order updated" });
          router.refresh();
        }}
      />

      <AlertDialog
        open={!!confirmTransition}
        onOpenChange={(open) => {
          if (!open && !transitioningTo) {
            setConfirmTransition(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTransition?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              {getTransitionDescription()}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!transitioningTo}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (confirmTransition) {
                  void performTransition(confirmTransition.toStatus);
                }
              }}
              disabled={!!transitioningTo}
            >
              {transitioningTo && (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              )}
              {confirmTransition?.label}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                  {formatOrderId(currentOrder.id)}
                </h1>
                <Badge
                  variant="outline"
                  className={cn(
                    "font-medium",
                    ORDER_STATUS_STYLES[currentOrder.status],
                  )}
                >
                  {formatEnumLabel(currentOrder.status)}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Created on {formatDateTime(currentOrder.createdAt)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Printer className="mr-1.5 size-4" />
              Print Receipt
            </Button>
            {availableTransitions.map((action) => {
              const Icon = action.icon;
              const isLoading = transitioningTo === action.toStatus;

              return (
                <Button
                  key={action.toStatus}
                  variant={action.variant}
                  size="sm"
                  disabled={!!transitioningTo}
                  onClick={() => handleTransitionAction(action)}
                >
                  {isLoading ? (
                    <Loader2 className="mr-1.5 size-4 animate-spin" />
                  ) : (
                    <Icon className="mr-1.5 size-4" />
                  )}
                  {action.label}
                </Button>
              );
            })}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="size-4" />
                  <span className="sr-only">More actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowEditOrderForm(true)}>
                  Edit order
                </DropdownMenuItem>
                {/* <DropdownMenuItem>Duplicate order</DropdownMenuItem> */}
                <DropdownMenuItem>Send invoice</DropdownMenuItem>
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
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base">Order Items</CardTitle>
                  {isPending && !showAddItemForm && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowAddItemForm(true);
                        setSubmitError(null);
                      }}
                    >
                      <Plus className="mr-1.5 size-4" />
                      Add Item
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {submitError && !showAddItemForm && (
                  <div className="border-b px-6 py-4">
                    <Alert variant="destructive">
                      <AlertDescription>{submitError}</AlertDescription>
                    </Alert>
                  </div>
                )}
                {showAddItemForm && isPending && (
                  <div className="border-b px-6 py-5">
                    <div className="space-y-4 rounded-md border bg-muted/20 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">Add item to order</p>
                          <p className="text-sm text-muted-foreground">
                            Select a product and adjust quantity, discount, or
                            tax before saving.
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShowAddItemForm(false);
                            resetNewItemForm();
                          }}
                        >
                          Cancel
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <Label>Product</Label>
                        <OrderProductCombobox
                          value={newItem.productId}
                          valueName={newItem.productName}
                          onChange={(product) =>
                            setNewItem((prev) => ({
                              ...prev,
                              productId: product.id,
                              productName: product.name,
                              sku: product.sku,
                              unitPriceCents: product.priceCents,
                            }))
                          }
                          apiClient={apiClient}
                        />
                        {newItem.productId && (
                          <p className="text-xs text-muted-foreground">
                            {newItem.sku || "No SKU"} &middot;{" "}
                            {formatCurrencyCents(newItem.unitPriceCents)} each
                          </p>
                        )}
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="space-y-2">
                          <Label htmlFor="qty">Qty</Label>
                          <Input
                            id="qty"
                            type="number"
                            min="1"
                            step="1"
                            value={newItem.qty}
                            onChange={(e) =>
                              setNewItem((prev) => ({
                                ...prev,
                                qty: Math.max(
                                  1,
                                  Number.parseInt(e.target.value, 10) || 1,
                                ),
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="discount">Discount ($)</Label>
                          <Input
                            id="discount"
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={newItem.discountDollars}
                            onChange={(e) =>
                              setNewItem((prev) => ({
                                ...prev,
                                discountDollars: e.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="tax">Tax ($)</Label>
                          <Input
                            id="tax"
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={newItem.taxDollars}
                            onChange={(e) =>
                              setNewItem((prev) => ({
                                ...prev,
                                taxDollars: e.target.value,
                              }))
                            }
                          />
                        </div>
                      </div>

                      {submitError && (
                        <Alert variant="destructive">
                          <AlertDescription>{submitError}</AlertDescription>
                        </Alert>
                      )}

                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium">
                          Line total: {formatCurrencyCents(lineTotal())}
                        </p>
                        <Button
                          onClick={handleAddItem}
                          disabled={submittingItem}
                        >
                          {submittingItem && (
                            <Loader2 className="mr-1.5 size-4 animate-spin" />
                          )}
                          Save Item
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                {currentOrder.items && currentOrder.items.length > 0 ? (
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
                        {isPending && (
                          <TableHead className="w-[56px] pr-6 text-right" />
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentOrder.items.map((item) => (
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
                            {formatCurrencyCents(item.unitPriceCents)}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.discountCents > 0 ? (
                              <span className="text-destructive">
                                -{formatCurrencyCents(item.discountCents)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrencyCents(item.taxCents)}
                          </TableCell>
                          <TableCell className="text-right pr-6 font-medium">
                            {formatCurrencyCents(item.lineTotalCents)}
                          </TableCell>
                          {isPending && (
                            <TableCell className="pr-6 text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    {removingItemId === item.id ? (
                                      <Loader2 className="size-4 animate-spin" />
                                    ) : (
                                      <MoreHorizontal className="size-4" />
                                    )}
                                    <span className="sr-only">
                                      Item actions
                                    </span>
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    disabled={
                                      !canRemoveItems ||
                                      removingItemId === item.id
                                    }
                                    onClick={() =>
                                      void handleRemoveItem(item.id)
                                    }
                                  >
                                    <Trash2 className="mr-2 size-4" />
                                    Remove
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          )}
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
                    <span>{formatCurrencyCents(currentOrder.subtotalCents)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="text-destructive">
                      -{formatCurrencyCents(currentOrder.discountCents)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Tax</span>
                    <span>{formatCurrencyCents(currentOrder.taxCents)}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between font-medium">
                    <span>Total</span>
                    <span className="text-lg">
                      {formatCurrencyCents(currentOrder.totalCents)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Customer, Location, Timeline */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Order Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Current</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-medium",
                      ORDER_STATUS_STYLES[currentOrder.status],
                    )}
                  >
                    {formatEnumLabel(currentOrder.status)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Created</span>
                  <span>{formatDateTime(currentOrder.createdAt)}</span>
                </div>
                {currentOrder.placedAt && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Placed</span>
                    <span>{formatDateTime(currentOrder.placedAt)}</span>
                  </div>
                )}
                {currentOrder.cancelledAt && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Cancelled</span>
                    <span>{formatDateTime(currentOrder.cancelledAt)}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Customer Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Customer Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {currentOrder.customer ? (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                        <User className="size-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {currentOrder.customer.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Customer
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="size-4 text-muted-foreground" />
                        <a
                          href={`mailto:${currentOrder.customer.email}`}
                          className="text-primary hover:underline"
                        >
                          {currentOrder.customer.email}
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
                {currentOrder.location ? (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-full bg-chart-2/15">
                        <MapPin className="size-5 text-chart-2" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {currentOrder.location.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Point of Sale
                        </p>
                      </div>
                    </div>
                    {(currentOrder.location.address ||
                      currentOrder.location.city) && (
                      <div className="text-sm text-muted-foreground">
                        {currentOrder.location.address && (
                          <p>{currentOrder.location.address}</p>
                        )}
                        {currentOrder.location.city && (
                          <p>{currentOrder.location.city}</p>
                        )}
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
                              {formatDateTime(log.createdAt)}
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
    </>
  );
}
