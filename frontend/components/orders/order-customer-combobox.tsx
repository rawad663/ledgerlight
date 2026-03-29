"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useApiClient } from "@/hooks/use-api";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";

export type OrderCustomerOption = {
  id: string;
  name: string;
  email: string;
};

type OrderCustomerComboboxProps = {
  value: string;
  valueName: string;
  onChange: (customer: OrderCustomerOption) => void;
  apiClient: ReturnType<typeof useApiClient>;
};

export function OrderCustomerCombobox({
  value,
  valueName,
  onChange,
  apiClient,
}: OrderCustomerComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [customers, setCustomers] = React.useState<OrderCustomerOption[]>([]);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;

    apiClient
      .GET("/customers", {
        params: {
          query: {
            limit: 100,
            search: debouncedSearch || undefined,
            status: "ACTIVE",
          },
        },
      })
      .then(({ data }) => {
        if (cancelled) return;
        setCustomers(
          (data?.data ?? []).map((customer) => ({
            id: customer.id,
            name: customer.name,
            email: customer.email,
          })),
        );
      });

    return () => {
      cancelled = true;
    };
  }, [apiClient, debouncedSearch, open]);

  React.useEffect(() => {
    if (!open) return;

    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
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
        onClick={() => setOpen((prev) => !prev)}
      >
        {value ? valueName : "Select customer..."}
        <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-50" />
      </Button>
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search customers..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>No customers found.</CommandEmpty>
              <CommandGroup>
                {customers.map((customer) => (
                  <CommandItem
                    key={customer.id}
                    value={customer.id}
                    onSelect={() => {
                      onChange(customer);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 size-4",
                        value === customer.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="flex flex-col">
                      <span>{customer.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {customer.email}
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
