"use client"

import * as React from "react"
import Link from "next/link"
import {
  Plus,
  Search,
  Download,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Package,
  Check,
  X,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Empty } from "@/components/ui/empty"

const products = [
  {
    id: "1",
    name: "Classic White T-Shirt",
    sku: "CWT-001",
    category: "Apparel",
    price: 29.99,
    active: true,
    inventory: "In Stock",
    stock: 245,
  },
  {
    id: "2",
    name: "Vintage Denim Jacket",
    sku: "VDJ-042",
    category: "Outerwear",
    price: 149.99,
    active: true,
    inventory: "Low Stock",
    stock: 12,
  },
  {
    id: "3",
    name: "Canvas Tote Bag - Natural",
    sku: "CTB-015-N",
    category: "Accessories",
    price: 34.99,
    active: true,
    inventory: "In Stock",
    stock: 89,
  },
  {
    id: "4",
    name: "Wool Beanie - Charcoal",
    sku: "WBN-008-C",
    category: "Accessories",
    price: 24.99,
    active: true,
    inventory: "Low Stock",
    stock: 8,
  },
  {
    id: "5",
    name: "Slim Fit Chinos - Navy",
    sku: "SFC-023-N",
    category: "Apparel",
    price: 79.99,
    active: true,
    inventory: "In Stock",
    stock: 156,
  },
  {
    id: "6",
    name: "Leather Belt - Brown",
    sku: "LBT-007-B",
    category: "Accessories",
    price: 45.00,
    active: false,
    inventory: "Out of Stock",
    stock: 0,
  },
  {
    id: "7",
    name: "Organic Cotton Hoodie",
    sku: "OCH-031",
    category: "Outerwear",
    price: 89.99,
    active: true,
    inventory: "In Stock",
    stock: 67,
  },
  {
    id: "8",
    name: "Striped Oxford Shirt",
    sku: "SOS-019",
    category: "Apparel",
    price: 64.99,
    active: true,
    inventory: "In Stock",
    stock: 112,
  },
  {
    id: "9",
    name: "Minimalist Watch - Silver",
    sku: "MWS-004",
    category: "Accessories",
    price: 199.99,
    active: true,
    inventory: "Low Stock",
    stock: 15,
  },
  {
    id: "10",
    name: "Summer Linen Dress",
    sku: "SLD-055",
    category: "Apparel",
    price: 119.99,
    active: false,
    inventory: "Out of Stock",
    stock: 0,
  },
]

const inventoryColors: Record<string, string> = {
  "In Stock": "bg-success/15 text-success border-success/30",
  "Low Stock": "bg-warning/15 text-warning-foreground border-warning/30",
  "Out of Stock": "bg-destructive/15 text-destructive border-destructive/30",
}

export function ProductsPage() {
  const [search, setSearch] = React.useState("")
  const [categoryFilter, setCategoryFilter] = React.useState("all")
  const [showEmpty, setShowEmpty] = React.useState(false)

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(search.toLowerCase()) ||
      product.sku.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = categoryFilter === "all" || product.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  // For demo: show empty state toggle
  const displayProducts = showEmpty ? [] : filteredProducts

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground">
            Manage your product catalog and pricing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowEmpty(!showEmpty)}>
            {showEmpty ? "Show Products" : "Show Empty State"}
          </Button>
          <Button variant="outline" size="sm">
            <Download className="mr-1.5 size-4" />
            Export
          </Button>
          <Button size="sm" asChild>
            <Link href="/products/new">
              <Plus className="mr-1.5 size-4" />
              Add Product
            </Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search products by name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="Apparel">Apparel</SelectItem>
            <SelectItem value="Outerwear">Outerwear</SelectItem>
            <SelectItem value="Accessories">Accessories</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Products Table */}
      <div className="rounded-lg border bg-card">
        {displayProducts.length === 0 ? (
          <div className="py-16">
            <Empty
              icon={Package}
              title="No products found"
              description={showEmpty 
                ? "Get started by adding your first product to the catalog."
                : "Try adjusting your search or filter criteria."
              }
            >
              {showEmpty ? (
                <Button size="sm" asChild>
                  <Link href="/products/new">
                    <Plus className="mr-1.5 size-4" />
                    Add Product
                  </Link>
                </Button>
              ) : (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    setSearch("")
                    setCategoryFilter("all")
                  }}
                >
                  Clear filters
                </Button>
              )}
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
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayProducts.map((product) => (
                  <TableRow key={product.id} className="cursor-pointer group">
                    <TableCell className="font-medium">
                      <Link href={`/products/${product.id}`} className="hover:text-primary">
                        {product.name}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {product.sku}
                    </TableCell>
                    <TableCell>{product.category}</TableCell>
                    <TableCell className="text-right font-medium">
                      ${product.price.toFixed(2)}
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
                        className={cn("font-medium", inventoryColors[product.inventory])}
                      >
                        {product.inventory}
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
                          <DropdownMenuItem asChild>
                            <Link href={`/products/${product.id}`}>View details</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem>Edit product</DropdownMenuItem>
                          <DropdownMenuItem>Duplicate</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive">
                            Delete product
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Showing <span className="font-medium">{displayProducts.length}</span> of{" "}
                <span className="font-medium">{products.length}</span> products
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled>
                  <ChevronLeft className="mr-1 size-4" />
                  Previous
                </Button>
                <Button variant="outline" size="sm">
                  Next
                  <ChevronRight className="ml-1 size-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
