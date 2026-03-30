"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check,ChevronsUpDown, Loader2 } from "lucide-react";
import * as React from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
import { Textarea } from "@/components/ui/textarea";
import { useApiClient } from "@/hooks/use-api";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { type components } from "@/lib/api-types";
import { cn } from "@/lib/utils";

type LocationDto = components["schemas"]["LocationDto"];
type ProductDto = components["schemas"]["ProductDto"];
type Reason = components["schemas"]["InventoryAdjustmentDto"]["reason"];

const REASON_LABELS: Record<string, string> = {
  MANUAL: "Manual",
  RESTOCK: "Restock",
  SALE: "Sale",
  RETURN: "Return",
  SHRINKAGE: "Shrinkage",
  COUNT_CORRECTION: "Count Correction",
  INITIAL_STOCK: "Initial Stock",
};

const REASONS = Object.keys(REASON_LABELS);

const adjustStockSchema = z.object({
  delta: z.coerce
    .number({ invalid_type_error: "Enter a number" })
    .int("Must be a whole number")
    .refine((v) => v !== 0, "Delta cannot be zero"),
  reason: z.string().min(1, "Select a reason"),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof adjustStockSchema>;

// ── Searchable Product Combobox (inline, no Portal) ────────────────────
function ProductCombobox({
  value,
  valueName,
  onChange,
  apiClient,
}: {
  value: string;
  valueName: string;
  onChange: (product: ProductDto) => void;
  apiClient: ReturnType<typeof useApiClient>;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [products, setProducts] = React.useState<ProductDto[]>([]);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    apiClient
      .GET("/products", {
        params: {
          query: {
            limit: 100,
            search: debouncedSearch || undefined,
            isActive: true,
          },
        },
      })
      .then(({ data }) => {
        if (!cancelled) setProducts(data?.data ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [open, debouncedSearch, apiClient]);

  React.useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className="w-full justify-between font-normal"
        onClick={() => setOpen(!open)}
      >
        {value ? valueName : "Select product..."}
        <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-50" />
      </Button>
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search products..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>No products found.</CommandEmpty>
              <CommandGroup>
                {products.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={p.id}
                    onSelect={() => {
                      onChange(p);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 size-4",
                        value === p.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="flex flex-col">
                      <span>{p.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {p.sku}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────
type AdjustStockFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  locations: LocationDto[];
  defaultProductId?: string | null;
  defaultProductName?: string | null;
  defaultLocationId?: string | null;
};

export function AdjustStockForm({
  open,
  onOpenChange,
  onSuccess,
  locations,
  defaultProductId,
  defaultProductName,
  defaultLocationId,
}: AdjustStockFormProps) {
  const apiClient = useApiClient();
  const [submitting, setSubmitting] = React.useState(false);
  const [apiError, setApiError] = React.useState<string | null>(null);

  // Product selection (managed outside react-hook-form since it's a combobox)
  const [productId, setProductId] = React.useState("");
  const [productName, setProductName] = React.useState("");
  const [locationId, setLocationId] = React.useState("");
  const [productError, setProductError] = React.useState<string | null>(null);
  const [locationError, setLocationError] = React.useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(adjustStockSchema),
    defaultValues: {
      delta: undefined as unknown as number,
      reason: "MANUAL",
      note: "",
    },
  });

  // Set defaults + reset on open/close
  React.useEffect(() => {
    if (open) {
      setProductId(defaultProductId ?? "");
      setProductName(defaultProductName ?? "");
      setLocationId(defaultLocationId ?? "");
      setApiError(null);
      setProductError(null);
      setLocationError(null);
      form.reset({
        delta: undefined as unknown as number,
        reason: "MANUAL",
        note: "",
      });
    }
  }, [open, defaultProductId, defaultProductName, defaultLocationId, form]);

  async function onSubmit(values: FormValues) {
    // Validate combobox fields
    let hasError = false;
    if (!productId) {
      setProductError("Select a product.");
      hasError = true;
    } else {
      setProductError(null);
    }
    if (!locationId) {
      setLocationError("Select a location.");
      hasError = true;
    } else {
      setLocationError(null);
    }
    if (hasError) return;

    setSubmitting(true);
    setApiError(null);

    const { data, error } = await apiClient.POST("/inventory/adjustments", {
      body: {
        productId,
        locationId,
        delta: values.delta,
        reason: values.reason as Reason,
        note: values.note || undefined,
      },
    });

    setSubmitting(false);

    if (error) {
      setApiError((error as Error)?.message ?? "Failed to create adjustment");
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
          <SheetTitle className="text-xl">Adjust Stock</SheetTitle>
          <SheetDescription>
            Adjust inventory for a product at a specific location.
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Product */}
            <div className="space-y-2">
              <FormLabel>Product</FormLabel>
              <ProductCombobox
                value={productId}
                valueName={productName}
                onChange={(p) => {
                  setProductId(p.id);
                  setProductName(p.name);
                  setProductError(null);
                }}
                apiClient={apiClient}
              />
              {productError && (
                <p className="text-sm text-destructive">{productError}</p>
              )}
            </div>

            {/* Location */}
            <div className="space-y-2">
              <FormLabel>Location</FormLabel>
              <Select
                value={locationId}
                onValueChange={(v) => {
                  setLocationId(v);
                  setLocationError(null);
                }}
              >
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
              {locationError && (
                <p className="text-sm text-destructive">{locationError}</p>
              )}
            </div>

            {/* Delta */}
            <FormField
              control={form.control}
              name="delta"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity Change</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="1"
                      placeholder="e.g. 10 or -5"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Positive to add stock, negative to reduce.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Reason */}
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select reason..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {REASONS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {REASON_LABELS[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Note */}
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Note (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Reason details..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
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
                Submit Adjustment
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
