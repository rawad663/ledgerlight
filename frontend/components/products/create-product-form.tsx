"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import * as z from "zod";

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

const createProductSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    sku: z.string().min(1, "SKU is required"),
    price: z
      .string()
      .min(1, "Price is required")
      .refine(
        (val) => {
          const num = parseFloat(val);
          return !isNaN(num) && num > 0;
        },
        { message: "Price must be a positive number" },
      ),
    category: z.string().optional(),
    customCategory: z.string().optional(),
    locationId: z.string().optional(),
    quantity: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.locationId && !data.quantity) return false;
      if (data.quantity && !data.locationId) return false;
      return true;
    },
    {
      message: "Both location and quantity are required for initial inventory",
      path: ["quantity"],
    },
  )
  .refine(
    (data) => {
      if (data.quantity) {
        const num = parseInt(data.quantity, 10);
        return !isNaN(num) && num > 0;
      }
      return true;
    },
    {
      message: "Quantity must be a positive whole number",
      path: ["quantity"],
    },
  );

type FormValues = z.infer<typeof createProductSchema>;

type CreateProductFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  categories: string[];
};

export function CreateProductForm({
  open,
  onOpenChange,
  onSuccess,
  categories,
}: CreateProductFormProps) {
  const apiClient = useApiClient();
  const [submitting, setSubmitting] = React.useState(false);
  const [apiError, setApiError] = React.useState<string | null>(null);
  const locations = useLocations({ enabled: open });

  const form = useForm<FormValues>({
    resolver: zodResolver(createProductSchema),
    defaultValues: {
      name: "",
      sku: "",
      price: "",
      category: "",
      customCategory: "",
      locationId: "",
      quantity: "",
    },
  });

  const selectedCategory = useWatch({
    control: form.control,
    name: "category",
  });

  React.useEffect(() => {
    if (!open) {
      form.reset();
      setApiError(null);
    }
  }, [open, form]);

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    setApiError(null);

    const priceCents = Math.round(parseFloat(values.price) * 100);
    const resolvedCategory =
      values.category === "__other__"
        ? values.customCategory?.trim() || null
        : values.category || null;

    const body: components["schemas"]["CreateProductDto"] = {
      name: values.name,
      sku: values.sku,
      priceCents,
      category: resolvedCategory,
    };

    if (values.locationId && values.quantity) {
      body.inventory = {
        locationId: values.locationId,
        quantity: parseInt(values.quantity, 10),
      };
    }

    const { data, error, response } = await apiClient.POST("/products", {
      body,
    });

    setSubmitting(false);

    if (error) {
      const message =
        (error as Error)?.message ??
        (response.status === 409
          ? "A product with this SKU already exists"
          : "Failed to create product");
      setApiError(message);
      return;
    }

    if (data) {
      onOpenChange(false);
      onSuccess?.();
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-xl">Add Product</SheetTitle>
          <SheetDescription>
            Create a new product in your catalog.
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Product name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sku"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>SKU</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. PROD-001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price ($)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      if (value !== "__other__") {
                        form.setValue("customCategory", "");
                      }
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                      <SelectItem value="__other__">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedCategory === "__other__" && (
              <FormField
                control={form.control}
                name="customCategory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Category</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter category name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <Separator />

            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">
                Initial Inventory (optional)
              </p>

              <FormField
                control={form.control}
                name="locationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a location" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {locations.map((loc) => (
                          <SelectItem key={loc.id} value={loc.id}>
                            {loc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        placeholder="0"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {apiError && <p className="text-sm text-destructive">{apiError}</p>}

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={submitting}>
                {submitting && (
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                )}
                Create Product
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
