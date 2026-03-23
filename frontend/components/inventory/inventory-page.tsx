"use client"

import * as React from "react"
import Link from "next/link"
import {
  Search,
  Download,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  RefreshCw,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
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

const inventory = [
  {
    id: "1",
    product: "Classic White T-Shirt (S)",
    sku: "CWT-001-S",
    location: "Downtown Store",
    available: 82,
    reserved: 5,
    reorderPoint: 20,
    reorderStatus: "OK",
  },
  {
    id: "2",
    product: "Classic White T-Shirt (M)",
    sku: "CWT-001-M",
    location: "Downtown Store",
    available: 3,
    reserved: 2,
    reorderPoint: 20,
    reorderStatus: "Reorder",
  },
  {
    id: "3",
    product: "Classic White T-Shirt (L)",
    sku: "CWT-001-L",
    location: "Downtown Store",
    available: 45,
    reserved: 8,
    reorderPoint: 20,
    reorderStatus: "OK",
  },
  {
    id: "4",
    product: "Vintage Denim Jacket",
    sku: "VDJ-042",
    location: "Downtown Store",
    available: 2,
    reserved: 1,
    reorderPoint: 10,
    reorderStatus: "Reorder",
  },
  {
    id: "5",
    product: "Canvas Tote Bag - Natural",
    sku: "CTB-015-N",
    location: "Downtown Store",
    available: 5,
    reserved: 3,
    reorderPoint: 15,
    reorderStatus: "Reorder",
  },
  {
    id: "6",
    product: "Wool Beanie - Charcoal",
    sku: "WBN-008-C",
    location: "Main Street",
    available: 4,
    reserved: 0,
    reorderPoint: 12,
    reorderStatus: "Reorder",
  },
  {
    id: "7",
    product: "Slim Fit Chinos - Navy (32)",
    sku: "SFC-023-N-32",
    location: "Main Street",
    available: 28,
    reserved: 2,
    reorderPoint: 10,
    reorderStatus: "OK",
  },
  {
    id: "8",
    product: "Slim Fit Chinos - Navy (34)",
    sku: "SFC-023-N-34",
    location: "Main Street",
    available: 35,
    reserved: 4,
    reorderPoint: 10,
    reorderStatus: "OK",
  },
  {
    id: "9",
    product: "Organic Cotton Hoodie (M)",
    sku: "OCH-031-M",
    location: "Westside Mall",
    available: 12,
    reserved: 0,
    reorderPoint: 8,
    reorderStatus: "OK",
  },
  {
    id: "10",
    product: "Organic Cotton Hoodie (L)",
    sku: "OCH-031-L",
    location: "Westside Mall",
    available: 8,
    reserved: 2,
    reorderPoint: 8,
    reorderStatus: "Warning",
  },
  {
    id: "11",
    product: "Striped Oxford Shirt (M)",
    sku: "SOS-019-M",
    location: "Westside Mall",
    available: 22,
    reserved: 1,
    reorderPoint: 10,
    reorderStatus: "OK",
  },
  {
    id: "12",
    product: "Minimalist Watch - Silver",
    sku: "MWS-004",
    location: "Downtown Store",
    available: 6,
    reserved: 2,
    reorderPoint: 5,
    reorderStatus: "Warning",
  },
]

const reorderStatusColors: Record<string, string> = {
  OK: "bg-success/15 text-success border-success/30",
  Warning: "bg-warning/15 text-warning-foreground border-warning/30",
  Reorder: "bg-destructive/15 text-destructive border-destructive/30",
}

export function InventoryPage() {
  const [search, setSearch] = React.useState("")
  const [locationFilter, setLocationFilter] = React.useState("all")
  const [lowStockOnly, setLowStockOnly] = React.useState(false)

  const filteredInventory = inventory.filter((item) => {
    const matchesSearch =
      item.product.toLowerCase().includes(search.toLowerCase()) ||
      item.sku.toLowerCase().includes(search.toLowerCase())
    const matchesLocation = locationFilter === "all" || item.location === locationFilter
    const matchesLowStock = !lowStockOnly || item.reorderStatus !== "OK"
    return matchesSearch && matchesLocation && matchesLowStock
  })

  const lowStockCount = inventory.filter((item) => item.reorderStatus !== "OK").length

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
            <p className="font-medium text-warning-foreground">Low Stock Alert</p>
            <p className="text-sm text-muted-foreground">
              {lowStockCount} items are below their reorder threshold and may need restocking.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-warning/30 text-warning-foreground hover:bg-warning/20"
            onClick={() => setLowStockOnly(true)}
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={locationFilter} onValueChange={setLocationFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Location" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            <SelectItem value="Downtown Store">Downtown Store</SelectItem>
            <SelectItem value="Main Street">Main Street</SelectItem>
            <SelectItem value="Westside Mall">Westside Mall</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 rounded-md border px-3 py-2">
          <Switch
            id="low-stock"
            checked={lowStockOnly}
            onCheckedChange={setLowStockOnly}
          />
          <Label htmlFor="low-stock" className="text-sm cursor-pointer">
            Low stock only
          </Label>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[280px]">Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead className="text-right">Reserved</TableHead>
              <TableHead className="text-right">Reorder Point</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInventory.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-muted-foreground">No inventory items found</p>
                    <Button variant="outline" size="sm" onClick={() => {
                      setSearch("")
                      setLocationFilter("all")
                      setLowStockOnly(false)
                    }}>
                      Clear filters
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredInventory.map((item) => (
                <TableRow
                  key={item.id}
                  className={cn(
                    "cursor-pointer group",
                    item.reorderStatus === "Reorder" && "bg-destructive/5"
                  )}
                >
                  <TableCell className="font-medium">{item.product}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {item.sku}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{item.location}</TableCell>
                  <TableCell className="text-right">
                    <span
                      className={cn(
                        "font-medium",
                        item.available <= item.reorderPoint && "text-destructive"
                      )}
                    >
                      {item.available}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {item.reserved}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {item.reorderPoint}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn("font-medium", reorderStatusColors[item.reorderStatus])}
                    >
                      {item.reorderStatus === "Reorder" && (
                        <AlertTriangle className="mr-1 size-3" />
                      )}
                      {item.reorderStatus}
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
                        <DropdownMenuItem>Create purchase order</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t px-4 py-3">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-medium">{filteredInventory.length}</span> of{" "}
            <span className="font-medium">{inventory.length}</span> items
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
      </div>
    </div>
  )
}
