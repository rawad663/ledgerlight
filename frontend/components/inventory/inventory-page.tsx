"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Search,
  Download,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  RefreshCw,
  Package,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useApiClient } from "@/hooks/use-api";
import { useCursorPagination } from "@/hooks/use-cursor-pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";

import { type components } from "@/lib/api-types";
import { useUrlSearch } from "@/hooks/use-url-search";

type InventoryLevel = components["schemas"]["InventoryLevelsDataDto"];
type LocationDto = components["schemas"]["LocationDto"];

export const INVENTORY_PAGE_LIMIT = 50;
const LOW_STOCK_THRESHOLD = 10;

type Props = {
  inventoryLevels: InventoryLevel[];
  total: number;
  nextCursor?: string;
  locations: LocationDto[];
  lowStockCount: number;
  initialSearch: string;
};

const statusColors: Record<string, string> = {
  OK: "bg-success/15 text-success border-success/30",
  Warning: "bg-warning/15 text-warning-foreground border-warning/30",
  Reorder: "bg-destructive/15 text-destructive border-destructive/30",
};

function getStockStatus(quantity: number): "OK" | "Warning" | "Reorder" {
  if (quantity === 0) return "Reorder";
  if (quantity <= LOW_STOCK_THRESHOLD) return "Warning";
  return "OK";
}

export function InventoryPage({
  inventoryLevels: initialLevels,
  total: initialTotal,
  nextCursor: initialNextCursor,
  locations,
  lowStockCount: initialLowStockCount,
  initialSearch,
}: Props) {
  const apiClient = useApiClient();

  const { searchParams, searchInput, setSearchInput, updateParams } =
    useUrlSearch(initialSearch);

  const search = searchParams.get("search") ?? "";
  const locationFilter = searchParams.get("location") ?? "all";
  const lowStockOnly = searchParams.get("lowStockOnly") === "true";

  const [lowStockCount, setLowStockCount] =
    React.useState(initialLowStockCount);

  const {
    data: inventoryLevels,
    total,
    hasNext,
    hasPrevious,
    goNext,
    goPrevious,
    showingFrom,
    showingTo,
    loading,
  } = useCursorPagination<InventoryLevel>({
    initialData: initialLevels,
    initialTotal,
    initialNextCursor,
    limit: INVENTORY_PAGE_LIMIT,
    filterKey: `${search}|${locationFilter}|${lowStockOnly}`,
    fetchPage: React.useCallback(
      async (cursor?: string) => {
        const { data } = await apiClient.GET("/inventory/levels", {
          params: {
            query: {
              limit: INVENTORY_PAGE_LIMIT,
              cursor,
              search: search || undefined,
              locationId: locationFilter === "all" ? undefined : locationFilter,
              lowStockOnly: lowStockOnly || undefined,
            },
          },
        });
        if (data?.lowStockCount !== undefined) {
          setLowStockCount(data.lowStockCount);
        }
        return {
          data: data?.data ?? [],
          totalCount: data?.totalCount ?? 0,
          nextCursor: data?.nextCursor ?? undefined,
        };
      },
      [apiClient, search, locationFilter, lowStockOnly],
    ),
  });

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground">
            Track stock levels across all locations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <RefreshCw className="mr-1.5 size-4" />
            Sync Inventory
          </Button>
          <Button variant="outline" size="sm">
            <Download className="mr-1.5 size-4" />
            Export
          </Button>
          <Button size="sm" asChild>
            <Link href="/inventory/adjust">Adjust Stock</Link>
          </Button>
        </div>
      </div>

      {/* Low Stock Banner */}
      {lowStockCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4">
          <div className="flex size-10 items-center justify-center rounded-full bg-warning/20">
            <AlertTriangle className="size-5 text-warning" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-warning-foreground">
              Low Stock Alert
            </p>
            <p className="text-sm text-muted-foreground">
              {lowStockCount} items are below their reorder threshold and may
              need restocking.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-warning/30 text-warning-foreground hover:bg-warning/20"
            onClick={() => updateParams({ lowStockOnly: "true" })}
          >
            View Items
          </Button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by product or SKU..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={locationFilter}
          onValueChange={(value) => updateParams({ location: value })}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Location" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            {locations.map((loc) => (
              <SelectItem key={loc.id} value={loc.id}>
                {loc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 rounded-md border px-3 py-2">
          <Switch
            id="low-stock"
            checked={lowStockOnly}
            onCheckedChange={(checked) =>
              updateParams({ lowStockOnly: checked ? "true" : "false" })
            }
          />
          <Label htmlFor="low-stock" className="text-sm cursor-pointer">
            Low stock only
          </Label>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="rounded-lg border bg-card">
        {inventoryLevels.length === 0 ? (
          <div className="py-16">
            <Empty
              icon={Package}
              title="No inventory items found"
              description="Try adjusting your search or filter criteria."
            >
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchInput("");
                  updateParams({
                    search: "",
                    location: "",
                    lowStockOnly: "false",
                  });
                }}
              >
                Clear filters
              </Button>
            </Empty>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[280px]">Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventoryLevels.map((item) => {
                  const status = getStockStatus(item.quantity);
                  return (
                    <TableRow
                      key={item.id}
                      className={cn(
                        "cursor-pointer group",
                        status === "Reorder" && "bg-destructive/5",
                      )}
                    >
                      <TableCell className="font-medium">
                        <Link
                          href={`/products/${item.product.id}`}
                          className="hover:text-primary"
                        >
                          {item.product.name}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {item.product.sku}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.location.name}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={cn(
                            "font-medium",
                            item.quantity <= LOW_STOCK_THRESHOLD &&
                              "text-destructive",
                          )}
                        >
                          {item.quantity}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn("font-medium", statusColors[status])}
                        >
                          {status === "Reorder" && (
                            <AlertTriangle className="mr-1 size-3" />
                          )}
                          {status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <MoreHorizontal className="size-4" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>Adjust quantity</DropdownMenuItem>
                            <DropdownMenuItem>Transfer stock</DropdownMenuItem>
                            <DropdownMenuItem>View history</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>
                              Create purchase order
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Showing{" "}
                <span className="font-medium">
                  {showingFrom}–{showingTo}
                </span>{" "}
                of <span className="font-medium">{total}</span> items
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasPrevious || loading}
                  onClick={goPrevious}
                >
                  <ChevronLeft className="mr-1 size-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasNext || loading}
                  onClick={goNext}
                >
                  Next
                  <ChevronRight className="ml-1 size-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
