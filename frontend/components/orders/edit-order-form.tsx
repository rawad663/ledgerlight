"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, X } from "lucide-react";
import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import * as z from "zod";

import {
  OrderCustomerCombobox,
  type OrderCustomerOption,
} from "@/components/orders/order-customer-combobox";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useApiClient } from "@/hooks/use-api";
import { useLocations } from "@/hooks/use-locations";
import { type components, type paths } from "@/lib/api-types";
import { formatEnumLabel, formatOrderId } from "@/lib/formatters";

type OrderStatus = components["schemas"]["OrderDto"]["status"];
type OrderCustomerDto = components["schemas"]["OrderCustomerDto"];
type OrderLocationDto = components["schemas"]["OrderLocationDto"];
type OrderLocationOption = {
  id: string;
  name: string;
};
type UpdateOrderRequestBody =
  paths["/orders/{id}"]["patch"]["requestBody"]["content"]["application/json"];

type EditableOrder = {
  id: string;
  status: OrderStatus;
  customerId?: string | null;
  locationId?: string | null;
  customer?: OrderCustomerDto | null;
  location?: OrderLocationDto | null;
};

const editOrderFormSchema = z.object({
  customerId: z.string(),
  customerName: z.string(),
  customerEmail: z.string(),
  locationId: z.string(),
});

type EditOrderFormValues = z.infer<typeof editOrderFormSchema>;

type EditOrderFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (result: {
    customer: OrderCustomerDto | null;
    location: OrderLocationDto | null;
  }) => void;
  order: EditableOrder | null;
  locations?: OrderLocationOption[];
};

function isOrderLocationDto(
  location: OrderLocationOption | OrderLocationDto | null,
): location is OrderLocationDto {
  return (
    location !== null &&
    "address" in location &&
    "city" in location &&
    typeof location.address === "string" &&
    typeof location.city === "string"
  );
}

export function EditOrderForm({
  open,
  onOpenChange,
  onSuccess,
  order,
  locations: providedLocations,
}: EditOrderFormProps) {
  const apiClient = useApiClient();
  const fetchedLocations = useLocations({
    enabled: open && !providedLocations,
  });
  const locations = providedLocations ?? fetchedLocations;
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [apiError, setApiError] = React.useState<string | null>(null);

  const form = useForm<EditOrderFormValues>({
    resolver: zodResolver(editOrderFormSchema),
    defaultValues: {
      customerId: "",
      customerName: "",
      customerEmail: "",
      locationId: "",
    },
  });

  React.useEffect(() => {
    if (!open || !order) {
      return;
    }

    form.reset({
      customerId: order.customerId ?? "",
      customerName: order.customer?.name ?? "",
      customerEmail: order.customer?.email ?? "",
      locationId: order.locationId ?? "",
    });
    setApiError(null);
  }, [form, open, order]);

  const customerId = useWatch({ control: form.control, name: "customerId" });
  const customerName = useWatch({
    control: form.control,
    name: "customerName",
  });
  const customerEmail = useWatch({
    control: form.control,
    name: "customerEmail",
  });
  const locationId = useWatch({ control: form.control, name: "locationId" });

  const selectedLocation =
    locations.find((location) => location.id === locationId) ?? null;
  const hasChanges =
    (order?.customerId ?? "") !== customerId ||
    (order?.locationId ?? "") !== locationId;

  async function handleSubmit(values: EditOrderFormValues) {
    if (!order) {
      return;
    }

    setIsSubmitting(true);
    setApiError(null);

    const body: UpdateOrderRequestBody = {
      customerId: values.customerId || null,
      locationId: values.locationId || null,
    };

    const { error } = await apiClient.PATCH("/orders/{id}", {
      params: { path: { id: order.id } },
      body,
    });

    setIsSubmitting(false);

    if (error) {
      setApiError((error as Error)?.message ?? "Failed to update order");
      return;
    }

    onOpenChange(false);
    onSuccess?.({
      customer: values.customerId
        ? {
            id: values.customerId,
            name: values.customerName,
            email: values.customerEmail,
          }
        : null,
      location: isOrderLocationDto(selectedLocation)
        ? {
            id: selectedLocation.id,
            name: selectedLocation.name,
            address: selectedLocation.address,
            city: selectedLocation.city,
          }
        : null,
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

        {order ? (
          <div className="space-y-5">
            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Order</span>
                  <span className="font-medium">{formatOrderId(order.id)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-medium">
                    {formatEnumLabel(order.status)}
                  </span>
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

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleSubmit)}
                className="space-y-5"
              >
                <FormField
                  control={form.control}
                  name="customerId"
                  render={() => (
                    <FormItem className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label>Customer</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-auto px-0 text-muted-foreground"
                          onClick={() => {
                            form.setValue("customerId", "");
                            form.setValue("customerName", "");
                            form.setValue("customerEmail", "");
                          }}
                          disabled={!customerId || isSubmitting}
                        >
                          <X className="mr-1 size-3.5" />
                          Clear customer
                        </Button>
                      </div>
                      <FormControl>
                        <OrderCustomerCombobox
                          value={customerId}
                          valueName={customerName}
                          onChange={(customer: OrderCustomerOption) => {
                            form.setValue("customerId", customer.id);
                            form.setValue("customerName", customer.name);
                            form.setValue("customerEmail", customer.email);
                          }}
                          apiClient={apiClient}
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        {customerEmail ||
                          "Leave blank to keep this order unassigned."}
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="locationId"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <FormLabel htmlFor="order-location">
                          Store Location
                        </FormLabel>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-auto px-0 text-muted-foreground"
                          onClick={() => field.onChange("")}
                          disabled={!locationId || isSubmitting}
                        >
                          <X className="mr-1 size-3.5" />
                          Clear location
                        </Button>
                      </div>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger id="order-location">
                            <SelectValue placeholder="Select a location" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {locations.map((location) => (
                            <SelectItem key={location.id} value={location.id}>
                              {location.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {apiError ? (
                  <p className="text-sm text-destructive">{apiError}</p>
                ) : null}

                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => onOpenChange(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={isSubmitting || !hasChanges}
                  >
                    {isSubmitting ? (
                      <Loader2 className="mr-1.5 size-4 animate-spin" />
                    ) : null}
                    Save Changes
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
