"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import * as React from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import * as z from "zod";

import { OrderCustomerCombobox } from "@/components/orders/order-customer-combobox";
import { OrderProductCombobox } from "@/components/orders/order-product-combobox";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useApiClient } from "@/hooks/use-api";
import { useLocations } from "@/hooks/use-locations";
import { type components } from "@/lib/api-types";
import {
  dollarsToCents,
  formatCurrencyCents,
} from "@/lib/formatters";

const orderLineItemSchema = z
  .object({
    productId: z.string().min(1, "Select a product."),
    productName: z.string(),
    sku: z.string(),
    unitPriceCents: z.number().nonnegative(),
    qty: z.coerce.number().int().min(1, "Quantity must be at least 1."),
    discountDollars: z.string(),
    taxDollars: z.string(),
  })
  .superRefine((lineItem, ctx) => {
    const subtotal = lineItem.qty * lineItem.unitPriceCents;
    const discount = dollarsToCents(lineItem.discountDollars);

    if (discount > subtotal) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Discount cannot exceed subtotal.",
        path: ["discountDollars"],
      });
    }
  });

const createOrderFormSchema = z
  .object({
    customerId: z.string(),
    customerName: z.string(),
    locationId: z.string(),
    lineItems: z.array(orderLineItemSchema).min(1, "Add at least one line item."),
  })
  .superRefine((values, ctx) => {
    const seenProductIds = new Set<string>();

    values.lineItems.forEach((lineItem, index) => {
      if (!lineItem.productId) {
        return;
      }

      if (seenProductIds.has(lineItem.productId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "This product is already on the order.",
          path: ["lineItems", index, "productId"],
        });
      }

      seenProductIds.add(lineItem.productId);
    });
  });

type CreateOrderFormValues = z.infer<typeof createOrderFormSchema>;

type CreateOrderFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (orderId: string) => void;
  defaultCustomerId?: string | null;
  defaultCustomerName?: string | null;
};

function createEmptyLineItem() {
  return {
    productId: "",
    productName: "",
    sku: "",
    unitPriceCents: 0,
    qty: 1,
    discountDollars: "",
    taxDollars: "",
  };
}

function getLineTotal(lineItem: CreateOrderFormValues["lineItems"][number]) {
  const subtotal = lineItem.qty * lineItem.unitPriceCents;
  const discount = dollarsToCents(lineItem.discountDollars);
  const tax = dollarsToCents(lineItem.taxDollars);

  return subtotal - discount + tax;
}

function collectFormMessages(
  errorValue: unknown,
  messages: string[] = [],
): string[] {
  if (!errorValue || typeof errorValue !== "object") {
    return messages;
  }

  if ("message" in errorValue && typeof errorValue.message === "string") {
    messages.push(errorValue.message);
  }

  Object.values(errorValue).forEach((nestedError) => {
    collectFormMessages(nestedError, messages);
  });

  return messages;
}

export function CreateOrderForm({
  open,
  onOpenChange,
  onSuccess,
  defaultCustomerId,
  defaultCustomerName,
}: CreateOrderFormProps) {
  const apiClient = useApiClient();
  const locations = useLocations({ enabled: open });
  const [apiError, setApiError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<CreateOrderFormValues>({
    resolver: zodResolver(createOrderFormSchema),
    defaultValues: {
      customerId: "",
      customerName: "",
      locationId: "",
      lineItems: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lineItems",
  });

  React.useEffect(() => {
    if (!open) {
      return;
    }

    form.reset({
      customerId: defaultCustomerId ?? "",
      customerName: defaultCustomerName ?? "",
      locationId: "",
      lineItems: [],
    });
    setApiError(null);
  }, [defaultCustomerId, defaultCustomerName, form, open]);

  const lineItems = useWatch({ control: form.control, name: "lineItems" }) ?? [];
  const customerId = useWatch({ control: form.control, name: "customerId" });
  const customerName = useWatch({
    control: form.control,
    name: "customerName",
  });
  const locationId = useWatch({ control: form.control, name: "locationId" });
  const orderSubtotal = lineItems.reduce(
    (sum, lineItem) => sum + lineItem.qty * lineItem.unitPriceCents,
    0,
  );
  const orderDiscount = lineItems.reduce(
    (sum, lineItem) => sum + dollarsToCents(lineItem.discountDollars),
    0,
  );
  const orderTax = lineItems.reduce(
    (sum, lineItem) => sum + dollarsToCents(lineItem.taxDollars),
    0,
  );
  const orderTotal = orderSubtotal - orderDiscount + orderTax;
  const validationMessages = Array.from(
    new Set(collectFormMessages(form.formState.errors)),
  );

  async function handleSubmit(values: CreateOrderFormValues) {
    setIsSubmitting(true);
    setApiError(null);

    const body: components["schemas"]["CreateOrderDto"] = {
      customerId: values.customerId || null,
      locationId: values.locationId || null,
      orderItems: values.lineItems.map((lineItem) => ({
        productId: lineItem.productId,
        qty: lineItem.qty,
        discountCents: dollarsToCents(lineItem.discountDollars),
        taxCents: dollarsToCents(lineItem.taxDollars),
      })),
    };

    const { data, error } = await apiClient.POST("/orders", { body });

    setIsSubmitting(false);

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
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-xl">Create Order</SheetTitle>
          <SheetDescription>
            Build a new order by selecting a customer and adding products.
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-6"
          >
            <FormField
              control={form.control}
              name="customerId"
              render={() => (
                <FormItem className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label>Customer (optional)</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-auto px-0 text-muted-foreground"
                      onClick={() => {
                        form.setValue("customerId", "");
                        form.setValue("customerName", "");
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
                      onChange={(customer) => {
                        form.setValue("customerId", customer.id, {
                          shouldValidate: true,
                        });
                        form.setValue("customerName", customer.name);
                      }}
                      apiClient={apiClient}
                    />
                  </FormControl>
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
                    <FormLabel>Location (optional)</FormLabel>
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
                      <SelectTrigger>
                        <SelectValue placeholder="Select location..." />
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

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Line Items</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append(createEmptyLineItem())}
                >
                  <Plus className="mr-1.5 size-4" />
                  Add Item
                </Button>
              </div>

              {fields.length === 0 ? (
                <p className="rounded-md border py-6 text-center text-sm text-muted-foreground">
                  No items added yet. Click &ldquo;Add Item&rdquo; to start.
                </p>
              ) : null}

              {fields.map((field, index) => {
                const lineItem = lineItems[index];

                return (
                  <div key={field.id} className="space-y-3 rounded-md border p-3">
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <OrderProductCombobox
                          value={lineItem?.productId ?? ""}
                          valueName={lineItem?.productName ?? ""}
                          onChange={(product) => {
                            form.setValue(
                              `lineItems.${index}.productId`,
                              product.id,
                              { shouldValidate: true },
                            );
                            form.setValue(
                              `lineItems.${index}.productName`,
                              product.name,
                            );
                            form.setValue(`lineItems.${index}.sku`, product.sku);
                            form.setValue(
                              `lineItems.${index}.unitPriceCents`,
                              product.priceCents,
                            );
                          }}
                          apiClient={apiClient}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>

                    {lineItem?.productId ? (
                      <p className="text-xs text-muted-foreground">
                        {lineItem.sku} &middot;{" "}
                        {formatCurrencyCents(lineItem.unitPriceCents)} each
                      </p>
                    ) : null}

                    <div className="grid grid-cols-3 gap-2">
                      <FormField
                        control={form.control}
                        name={`lineItems.${index}.qty`}
                        render={({ field: qtyField }) => (
                          <FormItem className="space-y-1">
                            <FormLabel className="text-xs">Qty</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="1"
                                step="1"
                                value={qtyField.value}
                                onChange={(event) =>
                                  qtyField.onChange(event.target.value)
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`lineItems.${index}.discountDollars`}
                        render={({ field: discountField }) => (
                          <FormItem className="space-y-1">
                            <FormLabel className="text-xs">
                              Discount ($)
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                {...discountField}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`lineItems.${index}.taxDollars`}
                        render={({ field: taxField }) => (
                          <FormItem className="space-y-1">
                            <FormLabel className="text-xs">Tax ($)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                {...taxField}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {lineItem?.productId ? (
                      <div className="flex justify-end text-sm font-medium">
                        Line total: {formatCurrencyCents(getLineTotal(lineItem))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {lineItems.length > 0 ? (
              <>
                <Separator />
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrencyCents(orderSubtotal)}</span>
                  </div>
                  {orderDiscount > 0 ? (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Discount</span>
                      <span className="text-destructive">
                        -{formatCurrencyCents(orderDiscount)}
                      </span>
                    </div>
                  ) : null}
                  {orderTax > 0 ? (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tax</span>
                      <span>{formatCurrencyCents(orderTax)}</span>
                    </div>
                  ) : null}
                  <Separator />
                  <div className="flex justify-between pt-1 text-base font-semibold">
                    <span>Total</span>
                    <span>{formatCurrencyCents(orderTotal)}</span>
                  </div>
                </div>
              </>
            ) : null}

            {validationMessages.length > 0 ? (
              <div className="space-y-1 rounded-md border border-destructive/50 bg-destructive/10 p-3">
                {validationMessages.map((message) => (
                  <p key={message} className="text-sm text-destructive">
                    {message}
                  </p>
                ))}
              </div>
            ) : null}

            {apiError ? (
              <p className="text-sm text-destructive">{apiError}</p>
            ) : null}

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                ) : null}
                Create Order
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
