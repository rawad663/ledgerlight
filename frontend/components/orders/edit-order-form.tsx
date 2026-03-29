"use client";

import * as React from "react";
import { Loader2, X } from "lucide-react";

import { useApiClient } from "@/hooks/use-api";
import { type components } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  OrderCustomerCombobox,
  type OrderCustomerOption,
} from "@/components/orders/order-customer-combobox";

type OrderStatus = components["schemas"]["OrderDto"]["status"];
type LocationDto = components["schemas"]["LocationDto"];
type OrderCustomerDto = components["schemas"]["OrderCustomerDto"];
type OrderLocationDto = components["schemas"]["OrderLocationDto"];

type EditableOrder = {
  id: string;
  status: OrderStatus;
  customerId?: string | null;
  locationId?: string | null;
  customer?: OrderCustomerDto | null;
  location?: OrderLocationDto | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (result: {
    customer: OrderCustomerDto | null;
    location: LocationDto | null;
  }) => void;
  order: EditableOrder | null;
  locations?: LocationDto[];
};

const EMPTY_LOCATIONS: LocationDto[] = [];

function formatOrderId(uuid: string): string {
  return `ORD-${uuid.substring(0, 8).toUpperCase()}`;
}

function formatStatus(status: string): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export function EditOrderForm({
  open,
  onOpenChange,
  onSuccess,
  order,
  locations: providedLocations,
}: Props) {
  const apiClient = useApiClient();
  const [submitting, setSubmitting] = React.useState(false);
  const [apiError, setApiError] = React.useState<string | null>(null);
  const [customerId, setCustomerId] = React.useState("");
  const [customerName, setCustomerName] = React.useState("");
  const [customerEmail, setCustomerEmail] = React.useState("");
  const [locationId, setLocationId] = React.useState("");
  const [locations, setLocations] = React.useState<LocationDto[]>(
    providedLocations ?? EMPTY_LOCATIONS,
  );

  React.useEffect(() => {
    if (!open || !order) return;

    setCustomerId(order.customerId ?? "");
    setCustomerName(order.customer?.name ?? "");
    setCustomerEmail(order.customer?.email ?? "");
    setLocationId(order.locationId ?? "");
    setApiError(null);
  }, [open, order]);

  React.useEffect(() => {
    if (!providedLocations) return;
    setLocations(providedLocations);
  }, [providedLocations]);

  React.useEffect(() => {
    if (!open || providedLocations) return;
    let cancelled = false;

    apiClient
      .GET("/inventory/levels", { params: { query: { limit: 1 } } })
      .then(({ data }) => {
        if (cancelled) return;
        setLocations(data?.locations ?? []);
      });

    return () => {
      cancelled = true;
    };
  }, [apiClient, providedLocations, open]);

  const selectedLocation =
    locations.find((location) => location.id === locationId) ?? null;
  const hasChanges =
    (order?.customerId ?? "") !== customerId ||
    (order?.locationId ?? "") !== locationId;

  async function handleSubmit() {
    if (!order) return;

    setSubmitting(true);
    setApiError(null);

    const { error } = await apiClient.PATCH("/orders/{id}", {
      params: { path: { id: order.id } },
      body: {
        customerId: customerId || null,
        locationId: locationId || null,
      },
    });

    setSubmitting(false);

    if (error) {
      setApiError((error as Error)?.message ?? "Failed to update order");
      return;
    }

    onOpenChange(false);
    onSuccess?.({
      customer: customerId
        ? {
            id: customerId,
            name: customerName,
            email: customerEmail,
          }
        : null,
      location: selectedLocation,
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-xl">Edit Order</SheetTitle>
          <SheetDescription>
            Update the customer and store location for this order.
          </SheetDescription>
        </SheetHeader>

        {order && (
          <div className="space-y-5">
            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Order</span>
                  <span className="font-medium">{formatOrderId(order.id)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-medium">{formatStatus(order.status)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Current customer</span>
                  <span className="text-right font-medium">
                    {order.customer?.name ?? "Unassigned"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Current location</span>
                  <span className="text-right font-medium">
                    {order.location?.name ?? "Unassigned"}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label>Customer</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto px-0 text-muted-foreground"
                  onClick={() => {
                    setCustomerId("");
                    setCustomerName("");
                    setCustomerEmail("");
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
                onChange={(customer: OrderCustomerOption) => {
                  setCustomerId(customer.id);
                  setCustomerName(customer.name);
                  setCustomerEmail(customer.email);
                }}
                apiClient={apiClient}
              />
              <p className="text-xs text-muted-foreground">
                {customerEmail || "Leave blank to keep this order unassigned."}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="order-location">Store Location</Label>
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
              <Select
                value={locationId}
                onValueChange={(value) => setLocationId(value)}
              >
                <SelectTrigger id="order-location">
                  <SelectValue placeholder="Select a location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {apiError && <p className="text-sm text-destructive">{apiError}</p>}

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={handleSubmit}
                disabled={submitting || !hasChanges}
              >
                {submitting && (
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
