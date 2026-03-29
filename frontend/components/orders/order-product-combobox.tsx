"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { useApiClient } from "@/hooks/use-api";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { type components } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

type ProductDto = components["schemas"]["ProductDto"];

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

type Props = {
  value: string;
  valueName: string;
  onChange: (product: ProductDto) => void;
  apiClient: ReturnType<typeof useApiClient>;
};

export function OrderProductCombobox({
  value,
  valueName,
  onChange,
  apiClient,
}: Props) {
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
        if (!cancelled) {
          setProducts(data?.data ?? []);
        }
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
        className="w-full justify-between font-normal text-left"
        onClick={() => setOpen(!open)}
      >
        <span className="truncate">
          {value ? valueName : "Select product..."}
        </span>
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
                {products.map((product) => (
                  <CommandItem
                    key={product.id}
                    value={product.id}
                    onSelect={() => {
                      onChange(product);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 size-4",
                        value === product.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="flex flex-col">
                      <span>{product.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {product.sku ?? "No SKU"} &middot;{" "}
                        {formatCents(product.priceCents)}
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
