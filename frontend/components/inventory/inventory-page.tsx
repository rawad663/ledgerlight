"use client";

import {
  AlertTriangle,
  Download,
  MoreHorizontal,
  Package,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { AdjustStockForm } from "@/components/inventory/adjust-stock-form";
import { PageHeader } from "@/components/shared/page-header";
import { PageSearchInput } from "@/components/shared/page-search-input";
import { PaginationFooter } from "@/components/shared/pagination-footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiClient } from "@/hooks/use-api";
import { useCursorPagination } from "@/hooks/use-cursor-pagination";
import { toast } from "@/hooks/use-toast";
import { useUrlSearch } from "@/hooks/use-url-search";
import { type components } from "@/lib/api-types";
import { getInventoryStockStatus, INVENTORY_STATUS_STYLES } from "@/lib/status";
import { cn } from "@/lib/utils";

type InventoryLevel = components["schemas"]["InventoryLevelsDataDto"];
type LocationDto = components["schemas"]["LocationDto"];

export const INVENTORY_PAGE_LIMIT = 50;
const LOW_STOCK_THRESHOLD = 10;

type InventoryPageProps = {
  inventoryLevels: InventoryLevel[];
  total: number;
  nextCursor?: string;
  locations: LocationDto[];
  lowStockCount: number;
  initialSearch: string;
};

export function InventoryPage({
  inventoryLevels: initialLevels,
  total: initialTotal,
  nextCursor: initialNextCursor,
  locations,
  lowStockCount: initialLowStockCount,
  initialSearch,
}: InventoryPageProps) {
  const apiClient = useApiClient();
  const router = useRouter();
  const { searchParams, searchInput, setSearchInput, updateParams } =
    useUrlSearch(initialSearch);
  const [isAdjustFormOpen, setIsAdjustFormOpen] = React.useState(false);
  const [adjustStockDefaults, setAdjustStockDefaults] = React.useState<{
    productId?: string;
    productName?: string;
    locationId?: string;
  }>({});

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
    refresh,
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

  const sortedInventoryLevels = React.useMemo(
    () =>
      [...inventoryLevels].sort((left, right) =>
        left.product.name.localeCompare(right.product.name),
      ),
    [inventoryLevels],
  );

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Inventory"
        description="Track stock levels across all locations."
        actions={
          <>
            <Button variant="outline" size="sm">
              <RefreshCw className="mr-1.5 size-4" />
              Sync Inventory
            </Button>
            <Button variant="outline" size="sm">
              <Download className="mr-1.5 size-4" />
              Export
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setAdjustStockDefaults({});
                setIsAdjustFormOpen(true);
              }}
            >
              Adjust Stock
            </Button>
          </>
        }
      />

      {lowStockCount > 0 ? (
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
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <PageSearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Search by product or SKU..."
        />
        <Select
          value={locationFilter}
          onValueChange={(value) => updateParams({ location: value })}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Location" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            {locations.map((location) => (
              <SelectItem key={location.id} value={location.id}>
                {location.name}
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
          <Label htmlFor="low-stock" className="cursor-pointer text-sm">
            Low stock only
          </Label>
        </div>
      </div>

      <div className={cn("rounded-lg border bg-card", loading && "opacity-60")}>
        {sortedInventoryLevels.length === 0 ? (
          <div className="py-16">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Package />
                </EmptyMedia>
                <EmptyTitle>No inventory items found</EmptyTitle>
                <EmptyDescription>
                  Try adjusting your search or filter criteria.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
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
              </EmptyContent>
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
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedInventoryLevels.map((item) => {
                  const stockStatus = getInventoryStockStatus(
                    item.quantity,
                    LOW_STOCK_THRESHOLD,
                  );

                  return (
                    <TableRow
                      key={item.id}
                      className={cn(
                        "group cursor-pointer",
                        stockStatus === "Reorder" && "bg-destructive/5",
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
                          className={cn(
                            "font-medium",
                            INVENTORY_STATUS_STYLES[stockStatus],
                          )}
                        >
                          {stockStatus === "Reorder" ? (
                            <AlertTriangle className="mr-1 size-3" />
                          ) : null}
                          {stockStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="opacity-0 transition-opacity group-hover:opacity-100"
                            >
                              <MoreHorizontal className="size-4" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setAdjustStockDefaults({
                                  productId: item.product.id,
                                  productName: item.product.name,
                                  locationId: item.location.id,
                                });
                                setIsAdjustFormOpen(true);
                              }}
                            >
                              Adjust quantity
                            </DropdownMenuItem>
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

            <PaginationFooter
              itemLabel="items"
              total={total}
              showingFrom={showingFrom}
              showingTo={showingTo}
              hasPrevious={hasPrevious}
              hasNext={hasNext}
              loading={loading}
              onPrevious={goPrevious}
              onNext={goNext}
            />
          </>
        )}
      </div>

      <AdjustStockForm
        open={isAdjustFormOpen}
        onOpenChange={setIsAdjustFormOpen}
        locations={locations}
        defaultProductId={adjustStockDefaults.productId}
        defaultProductName={adjustStockDefaults.productName}
        defaultLocationId={adjustStockDefaults.locationId}
        onSuccess={() => {
          toast({ title: "Stock adjusted" });
          refresh();
        }}
      />
    </div>
  );
}
