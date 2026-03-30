import type { OrderStatus } from "@/lib/status";

export const dashboardSalesData = [
  { date: "Mon", sales: 2400 },
  { date: "Tue", sales: 1398 },
  { date: "Wed", sales: 3200 },
  { date: "Thu", sales: 2780 },
  { date: "Fri", sales: 4890 },
  { date: "Sat", sales: 5390 },
  { date: "Sun", sales: 3490 },
];

export const dashboardMetrics = [
  { label: "Today's Sales", value: "$4,285", trend: "+12%", trendDirection: "up" as const },
  { label: "Orders Today", value: "28", trend: "+8%", trendDirection: "up" as const },
  { label: "Low Stock Items", value: "12", trend: "3 critical", trendDirection: "down" as const },
  { label: "Active Customers", value: "1,284", trend: "+5%", trendDirection: "up" as const },
];

export const dashboardRecentOrders: Array<{
  id: string;
  customer: string;
  status: OrderStatus;
  items: number;
  total: string;
  time: string;
}> = [
  { id: "ORD-7821", customer: "Emily Parker", status: "PENDING", items: 3, total: "$245.00", time: "2 min ago" },
  { id: "ORD-7820", customer: "James Wilson", status: "CONFIRMED", items: 1, total: "$89.99", time: "15 min ago" },
  { id: "ORD-7819", customer: "Maria Garcia", status: "CONFIRMED", items: 5, total: "$412.50", time: "32 min ago" },
  { id: "ORD-7818", customer: "David Chen", status: "CANCELLED", items: 2, total: "$156.00", time: "1 hr ago" },
  { id: "ORD-7817", customer: "Sophie Brown", status: "CONFIRMED", items: 4, total: "$328.75", time: "2 hr ago" },
];

export const dashboardLowStockItems = [
  { name: "Classic White T-Shirt (M)", sku: "CWT-001-M", stock: 3, reorderPoint: 10 },
  { name: "Vintage Denim Jacket", sku: "VDJ-042", stock: 2, reorderPoint: 5 },
  { name: "Canvas Tote Bag - Natural", sku: "CTB-015-N", stock: 5, reorderPoint: 15 },
  { name: "Wool Beanie - Charcoal", sku: "WBN-008-C", stock: 4, reorderPoint: 12 },
];
