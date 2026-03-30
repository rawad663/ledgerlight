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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useApiClient } from "@/hooks/use-api";
import { type components } from "@/lib/api-types";

type ProductDto = components["schemas"]["ProductDto"];

const editProductSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sku: z.string().min(1, "SKU is required"),
  price: z
    .string()
    .min(1, "Price is required")
    .refine(
      (val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num >= 0;
      },
      { message: "Price must be a non-negative number" },
    ),
  category: z.string().optional(),
  customCategory: z.string().optional(),
  active: z.boolean(),
});

type FormValues = z.infer<typeof editProductSchema>;

type EditProductFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  product: ProductDto | null;
  categories: string[];
};

export function EditProductForm({
  open,
  onOpenChange,
  onSuccess,
  product,
  categories,
}: EditProductFormProps) {
  const apiClient = useApiClient();
  const [submitting, setSubmitting] = React.useState(false);
  const [apiError, setApiError] = React.useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(editProductSchema),
    defaultValues: {
      name: "",
      sku: "",
      price: "",
      category: "",
      customCategory: "",
      active: true,
    },
  });

  const selectedCategory = useWatch({
    control: form.control,
    name: "category",
  });

  // Reset form with product values when opened
  React.useEffect(() => {
    if (open && product) {
      const productCategory = product.category ?? "";
      const isCustom = productCategory && !categories.includes(productCategory);

      form.reset({
        name: product.name,
        sku: product.sku,
        price: (product.priceCents / 100).toFixed(2),
        category: isCustom ? "__other__" : productCategory,
        customCategory: isCustom ? productCategory : "",
        active: product.active,
      });
      setApiError(null);
    }
  }, [open, product, categories, form]);

  async function onSubmit(values: FormValues) {
    if (!product) return;

    setSubmitting(true);
    setApiError(null);

    const priceCents = Math.round(parseFloat(values.price) * 100);
    const resolvedCategory =
      values.category === "__other__"
        ? values.customCategory?.trim() || null
        : values.category || null;

    const body: components["schemas"]["UpdateProductDto"] = {};

    if (values.name !== product.name) body.name = values.name;
    if (values.sku !== product.sku) body.sku = values.sku;
    if (priceCents !== product.priceCents) body.priceCents = priceCents;
    if (resolvedCategory !== (product.category ?? null))
      body.category = resolvedCategory;
    if (values.active !== product.active) body.active = values.active;

    // Nothing changed
    if (Object.keys(body).length === 0) {
      onOpenChange(false);
      return;
    }

    const { data, error, response } = await apiClient.PATCH("/products/{id}", {
      params: { path: { id: product.id } },
      body,
    });

    setSubmitting(false);

    if (error) {
      const message =
        (error as Error)?.message ??
        (response.status === 409
          ? "A product with this SKU already exists"
          : "Failed to update product");
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
          <SheetTitle className="text-xl">Edit Product</SheetTitle>
          <SheetDescription>
            Update the details of this product.
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

            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <FormLabel className="text-sm font-medium">
                      Active
                    </FormLabel>
                    <p className="text-xs text-muted-foreground">
                      Inactive products are hidden from new orders.
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

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
                Save Changes
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
