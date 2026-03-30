"use client";

import {
  Check,
  Download,
  MoreHorizontal,
  Package,
  Plus,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { CreateProductForm } from "@/components/products/create-product-form";
import { DeleteProductDialog } from "@/components/products/delete-product-dialog";
import { EditProductForm } from "@/components/products/edit-product-form";
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
import { useApiClient } from "@/hooks/use-api";
import { useCursorPagination } from "@/hooks/use-cursor-pagination";
import { toast } from "@/hooks/use-toast";
import { useUrlSearch } from "@/hooks/use-url-search";
import { type components } from "@/lib/api-types";
import { formatCurrencyAmount } from "@/lib/formatters";
import { cn } from "@/lib/utils";

const PRODUCT_INVENTORY_STYLES: Record<string, string> = {
  "In Stock": "bg-success/15 text-success border-success/30",
  "Low Stock": "bg-warning/15 text-warning-foreground border-warning/30",
  "Out of Stock": "bg-destructive/15 text-destructive border-destructive/30",
};

export type Product = components["schemas"]["ProductDto"];

type ProductRowViewModel = Product & {
  stock: number;
  inventoryLabel: string;
  price: number;
};

export const PRODUCTS_PAGE_LIMIT = 50;

type ProductsPageProps = {
  products: Product[];
  total: number;
  nextCursor?: string;
  categories: string[];
  initialSearch: string;
};

function toProductRowViewModel(product: Product): ProductRowViewModel {
  return {
    ...product,
    category: product.category ?? "-",
    stock: 12,
    inventoryLabel: "In Stock",
    price: product.priceCents / 100,
  };
}

export function ProductsPage({
  products: initialProducts,
  total: initialTotal,
  nextCursor: initialNextCursor,
  categories,
  initialSearch,
}: ProductsPageProps) {
  const apiClient = useApiClient();
  const router = useRouter();
  const { searchParams, searchInput, setSearchInput, updateParams } =
    useUrlSearch(initialSearch);
  const [isCreateFormOpen, setIsCreateFormOpen] = React.useState(false);
  const [productBeingEdited, setProductBeingEdited] =
    React.useState<Product | null>(null);
  const [productBeingDeleted, setProductBeingDeleted] = React.useState<{
    id: string;
    name: string;
  } | null>(null);
  const [showForcedEmptyState, setShowForcedEmptyState] = React.useState(false);

  const search = searchParams.get("search") ?? "";
  const categoryFilter = searchParams.get("category") ?? "all";

  const {
    data: products,
    total,
    hasNext,
    hasPrevious,
    refresh,
    goNext,
    goPrevious,
    showingFrom,
    showingTo,
    loading,
  } = useCursorPagination<Product>({
    initialData: initialProducts,
    initialTotal,
    initialNextCursor,
    limit: PRODUCTS_PAGE_LIMIT,
    filterKey: `${search}|${categoryFilter}`,
    fetchPage: React.useCallback(
      async (cursor?: string) => {
        const { data } = await apiClient.GET("/products", {
          params: {
            query: {
              limit: PRODUCTS_PAGE_LIMIT,
              cursor,
              search: search || undefined,
              category: categoryFilter === "all" ? undefined : categoryFilter,
            },
          },
        });

        return {
          data: data?.data ?? [],
          totalCount: data?.totalCount ?? 0,
          nextCursor: data?.nextCursor ?? undefined,
        };
      },
      [apiClient, search, categoryFilter],
    ),
  });

  const productRows = (showForcedEmptyState ? [] : products).map(
    toProductRowViewModel,
  );

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Products"
        description="Manage your product catalog and pricing."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowForcedEmptyState((current) => !current)}
            >
              {showForcedEmptyState ? "Show Products" : "Show Empty State"}
            </Button>
            <Button variant="outline" size="sm">
              <Download className="mr-1.5 size-4" />
              Export
            </Button>
            <Button size="sm" onClick={() => setIsCreateFormOpen(true)}>
              <Plus className="mr-1.5 size-4" />
              Add Product
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <PageSearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Search products by name or SKU..."
        />
        <Select
          value={categoryFilter}
          onValueChange={(value) => updateParams({ category: value })}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className={cn("rounded-lg border bg-card", loading && "opacity-60")}>
        {productRows.length === 0 ? (
          <div className="py-16">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Package />
                </EmptyMedia>
                <EmptyTitle>No products found</EmptyTitle>
                <EmptyDescription>
                  {showForcedEmptyState
                    ? "Get started by adding your first product to the catalog."
                    : "Try adjusting your search or filter criteria."}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                {showForcedEmptyState ? (
                  <Button size="sm" onClick={() => setIsCreateFormOpen(true)}>
                    <Plus className="mr-1.5 size-4" />
                    Add Product
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchInput("");
                      updateParams({ search: "", category: "" });
                    }}
                  >
                    Clear filters
                  </Button>
                )}
              </EmptyContent>
            </Empty>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[300px]">Product Name</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-center">Active</TableHead>
                  <TableHead>Inventory</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {productRows.map((product) => (
                  <TableRow key={product.id} className="group cursor-pointer">
                    <TableCell className="font-medium">
                      <Link
                        href={`/products/${product.id}`}
                        className="hover:text-primary"
                      >
                        {product.name}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {product.sku}
                    </TableCell>
                    <TableCell>{product.category}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrencyAmount(product.price)}
                    </TableCell>
                    <TableCell className="text-center">
                      {product.active ? (
                        <div className="flex justify-center">
                          <div className="flex size-5 items-center justify-center rounded-full bg-success/15">
                            <Check className="size-3 text-success" />
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-center">
                          <div className="flex size-5 items-center justify-center rounded-full bg-muted">
                            <X className="size-3 text-muted-foreground" />
                          </div>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-medium",
                          PRODUCT_INVENTORY_STYLES[product.inventoryLabel],
                        )}
                      >
                        {product.inventoryLabel}
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
                          <DropdownMenuItem asChild>
                            <Link href={`/products/${product.id}`}>
                              View details
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              const originalProduct = products.find(
                                (candidate) => candidate.id === product.id,
                              );

                              if (originalProduct) {
                                setProductBeingEdited(originalProduct);
                              }
                            }}
                          >
                            Edit product
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() =>
                              setProductBeingDeleted({
                                id: product.id,
                                name: product.name,
                              })
                            }
                          >
                            Deactivate product
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <PaginationFooter
              itemLabel="products"
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

      <CreateProductForm
        open={isCreateFormOpen}
        onOpenChange={setIsCreateFormOpen}
        categories={categories}
        onSuccess={() => {
          toast({ title: "Product created" });
          refresh();
        }}
      />

      <EditProductForm
        open={!!productBeingEdited}
        onOpenChange={(open) => {
          if (!open) {
            setProductBeingEdited(null);
          }
        }}
        product={productBeingEdited}
        categories={categories}
        onSuccess={() => {
          toast({ title: "Product updated" });
          refresh();
        }}
      />

      <DeleteProductDialog
        open={!!productBeingDeleted}
        onOpenChange={(open) => {
          if (!open) {
            setProductBeingDeleted(null);
          }
        }}
        product={productBeingDeleted}
        onSuccess={() => {
          toast({ title: "Product deactivated" });
          refresh();
        }}
      />
    </div>
  );
}
