"use client";

import * as React from "react";
import { Loader2, Plus, Trash2, X } from "lucide-react";

import { useApiClient } from "@/hooks/use-api";
import { type components } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { OrderCustomerCombobox } from "@/components/orders/order-customer-combobox";
import { OrderProductCombobox } from "@/components/orders/order-product-combobox";

type LocationDto = components["schemas"]["LocationDto"];

type LineItem = {
  key: string;
  productId: string;
  productName: string;
  sku: string;
  unitPriceCents: number;
  qty: number;
  discountDollars: string;
  taxDollars: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (orderId: string) => void;
  defaultCustomerId?: string | null;
  defaultCustomerName?: string | null;
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function dollarsToCents(dollars: string): number {
  const num = parseFloat(dollars);
  if (isNaN(num) || num < 0) return 0;
  return Math.round(num * 100);
}

let lineKeyCounter = 0;
function nextLineKey() {
  return `line-${++lineKeyCounter}`;
}

// ── Main Component ─────────────────────────────────────────────────────
export function CreateOrderForm({
  open,
  onOpenChange,
  onSuccess,
  defaultCustomerId,
  defaultCustomerName,
}: Props) {
  const apiClient = useApiClient();
  const [submitting, setSubmitting] = React.useState(false);
  const [apiError, setApiError] = React.useState<string | null>(null);
  const [validationErrors, setValidationErrors] = React.useState<string[]>([]);

  // Customer
  const [customerId, setCustomerId] = React.useState("");
  const [customerName, setCustomerName] = React.useState("");

  // Location
  const [locationId, setLocationId] = React.useState("");
  const [locations, setLocations] = React.useState<LocationDto[]>([]);

  // Line items
  const [lineItems, setLineItems] = React.useState<LineItem[]>([]);

  // Fetch locations on open
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    apiClient
      .GET("/inventory/levels", { params: { query: { limit: 1 } } })
      .then(({ data }) => {
        if (!cancelled && data?.locations) {
          setLocations(data.locations);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, apiClient]);

  // Set defaults + reset on open/close
  React.useEffect(() => {
    if (open) {
      setCustomerId(defaultCustomerId ?? "");
      setCustomerName(defaultCustomerName ?? "");
      setLocationId("");
      setLineItems([]);
      setApiError(null);
      setValidationErrors([]);
    }
  }, [open, defaultCustomerId, defaultCustomerName]);

  function addLineItem() {
    setLineItems((prev) => [
      ...prev,
      {
        key: nextLineKey(),
        productId: "",
        productName: "",
        sku: "",
        unitPriceCents: 0,
        qty: 1,
        discountDollars: "",
        taxDollars: "",
      },
    ]);
  }

  function updateLineItem(index: number, patch: Partial<LineItem>) {
    setLineItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }

  function removeLineItem(index: number) {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }

  // ── Computed totals ──────────────────────────────────────────────────
  function lineSubtotal(item: LineItem): number {
    return item.qty * item.unitPriceCents;
  }

  function lineDiscount(item: LineItem): number {
    return dollarsToCents(item.discountDollars);
  }

  function lineTax(item: LineItem): number {
    return dollarsToCents(item.taxDollars);
  }

  function lineTotal(item: LineItem): number {
    return lineSubtotal(item) - lineDiscount(item) + lineTax(item);
  }

  const orderSubtotal = lineItems.reduce(
    (sum, li) => sum + lineSubtotal(li),
    0,
  );
  const orderDiscount = lineItems.reduce(
    (sum, li) => sum + lineDiscount(li),
    0,
  );
  const orderTax = lineItems.reduce((sum, li) => sum + lineTax(li), 0);
  const orderTotal = orderSubtotal - orderDiscount + orderTax;

  // ── Validation ───────────────────────────────────────────────────────
  function validate(): string[] {
    const errors: string[] = [];
    if (lineItems.length === 0) {
      errors.push("Add at least one line item.");
    }
    lineItems.forEach((item, i) => {
      if (!item.productId) errors.push(`Line ${i + 1}: select a product.`);
      if (item.qty < 1)
        errors.push(`Line ${i + 1}: quantity must be at least 1.`);
      if (lineDiscount(item) > lineSubtotal(item)) {
        errors.push(`Line ${i + 1}: discount cannot exceed subtotal.`);
      }
    });
    return errors;
  }

  async function handleSubmit() {
    const errors = validate();
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors([]);
    setSubmitting(true);
    setApiError(null);

    const body: components["schemas"]["CreateOrderDto"] = {
      customerId: customerId || null,
      locationId: locationId || null,
      orderItems: lineItems.map((li) => ({
        productId: li.productId,
        qty: li.qty,
        discountCents: dollarsToCents(li.discountDollars),
        taxCents: dollarsToCents(li.taxDollars),
      })),
    };

    const { data, error } = await apiClient.POST("/orders", { body });
    setSubmitting(false);

    if (error) {
      setApiError((error as Error)?.message ?? "Failed to create order");
      return;
    }

    if (data) {
      onOpenChange(false);
      onSuccess?.(data.id);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-xl">Create Order</SheetTitle>
          <SheetDescription>
            Build a new order by selecting a customer and adding products.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          {/* Customer */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label>Customer (optional)</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto px-0 text-muted-foreground"
                onClick={() => {
                  setCustomerId("");
                  setCustomerName("");
                }}
                disabled={!customerId || submitting}
              >
                <X className="mr-1 size-3.5" />
                Clear customer
              </Button>
            </div>
            <OrderCustomerCombobox
              value={customerId}
              valueName={customerName}
              onChange={(customer) => {
                setCustomerId(customer.id);
                setCustomerName(customer.name);
              }}
              apiClient={apiClient}
            />
          </div>

          {/* Location */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label>Location (optional)</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto px-0 text-muted-foreground"
                onClick={() => setLocationId("")}
                disabled={!locationId || submitting}
              >
                <X className="mr-1 size-3.5" />
                Clear location
              </Button>
            </div>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger>
                <SelectValue placeholder="Select location..." />
              </SelectTrigger>
              <SelectContent>
                {locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Line Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Line Items</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addLineItem}
              >
                <Plus className="mr-1.5 size-4" />
                Add Item
              </Button>
            </div>

            {lineItems.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6 border rounded-md">
                No items added yet. Click &ldquo;Add Item&rdquo; to start.
              </p>
            )}

            {lineItems.map((item, index) => (
              <div key={item.key} className="rounded-md border p-3 space-y-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <OrderProductCombobox
                      value={item.productId}
                      valueName={item.productName}
                      onChange={(product) => {
                        updateLineItem(index, {
                          productId: product.id,
                          productName: product.name,
                          sku: product.sku,
                          unitPriceCents: product.priceCents,
                        });
                      }}
                      apiClient={apiClient}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeLineItem(index)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>

                {item.productId && (
                  <p className="text-xs text-muted-foreground">
                    {item.sku} &middot; {formatCents(item.unitPriceCents)} each
                  </p>
                )}

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Qty</Label>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={item.qty}
                      onChange={(e) =>
                        updateLineItem(index, {
                          qty: Math.max(1, parseInt(e.target.value, 10) || 1),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Discount ($)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={item.discountDollars}
                      onChange={(e) =>
                        updateLineItem(index, {
                          discountDollars: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tax ($)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={item.taxDollars}
                      onChange={(e) =>
                        updateLineItem(index, { taxDollars: e.target.value })
                      }
                    />
                  </div>
                </div>

                {item.productId && (
                  <div className="flex justify-end text-sm font-medium">
                    Line total: {formatCents(lineTotal(item))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Order Summary */}
          {lineItems.length > 0 && (
            <>
              <Separator />
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCents(orderSubtotal)}</span>
                </div>
                {orderDiscount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="text-destructive">
                      -{formatCents(orderDiscount)}
                    </span>
                  </div>
                )}
                {orderTax > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax</span>
                    <span>{formatCents(orderTax)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-semibold text-base pt-1">
                  <span>Total</span>
                  <span>{formatCents(orderTotal)}</span>
                </div>
              </div>
            </>
          )}

          {/* Errors */}
          {validationErrors.length > 0 && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 space-y-1">
              {validationErrors.map((err, i) => (
                <p key={i} className="text-sm text-destructive">
                  {err}
                </p>
              ))}
            </div>
          )}
          {apiError && <p className="text-sm text-destructive">{apiError}</p>}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={submitting}
              onClick={handleSubmit}
            >
              {submitting && <Loader2 className="mr-1.5 size-4 animate-spin" />}
              Create Order
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
