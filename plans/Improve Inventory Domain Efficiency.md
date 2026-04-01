# Inventory Service Efficiency Analysis & Improvement Plan

## Context
`inventory.service.ts` handles three distinct read patterns (aggregated inventory, paginated levels, low-stock count) plus write operations (adjustment, create/update/delete level). Several methods fetch entire tables into Node.js memory before filtering, sorting, and paginating — a pattern that degrades linearly with catalog size and causes redundant work between callers.

---

## Efficiency Audit

### `getAggregatedInventorySnapshot` — called by `getInventory` and `getLowStockProductCount`

| Metric | Value |
|--------|-------|
| DB queries | 1 |
| Rows loaded | ALL products × ALL their inventory levels (unbounded) |
| In-memory passes | `map` → inner `reduce` → inner `sort` per product |

**Problem:** Every call fetches the entire product catalog with all inventory level rows regardless of the caller's actual need. `getLowStockProductCount` only wants a single integer, but it pulls and assembles full `AggregatedInventoryRow` objects for every product.

---

### `getLowStockProductCount`

| Metric | Value |
|--------|-------|
| DB queries | 1 (via `getAggregatedInventorySnapshot`) |
| Rows loaded | ALL products + ALL inventory levels |
| Work done | Builds full snapshot, throws away everything except `.length` |

**Problem:** This is O(all rows) for what should be a single `COUNT` query. Because it reuses `getAggregatedInventorySnapshot`, it also re-computes `totalQuantity` per product and builds `locations[]` arrays that are immediately discarded.

**Proposed fix:** Replace with a single Prisma `$queryRaw` or `groupBy` that aggregates `SUM(quantity)` per product and filters `SUM < reorderThreshold` at the DB level:

```ts
async getLowStockProductCount(organizationId: string): Promise<number> {
  const result = await this.prismaService.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*)::int AS count
    FROM (
      SELECT il."productId", SUM(il.quantity) AS total_qty, p."reorderThreshold"
      FROM "InventoryLevel" il
      JOIN "Product" p ON p.id = il."productId"
      WHERE p."organizationId" = ${organizationId}
      GROUP BY il."productId", p."reorderThreshold"
      HAVING SUM(il.quantity) <= p."reorderThreshold"
    ) sub
  `;
  return Number(result[0].count);
}
```

DB queries: **1 lightweight aggregation** instead of loading all rows.

---

### `getLevels`

| Metric | Value |
|--------|-------|
| DB queries | 3 in parallel |
| Query 1 (`levels`) | Filtered inventory levels + product + location |
| Query 2 (`locations`) | All org locations (reasonable) |
| Query 3 (`orgWideLevels`) | **ALL inventory levels in the org** just to compute `lowStockCount` |
| In-memory passes | filter (lowStockOnly) → sort → findIndex (O(N) cursor scan) → slice → map |

**Problem 1 — `orgWideLevels`:** Fetches every inventory level row in the org unconditionally on every call, regardless of whether the caller's `search`/`locationId` filters are active. Its only purpose is computing `lowStockCount`. This is a full unbounded scan on every page load.

**Proposed fix:** Replace query 3 with a `$queryRaw` aggregation (same pattern as `getLowStockProductCount`). Note: `paginateMany`'s built-in `count` call counts only the *filtered* result set (by `search`/`locationId`), whereas `lowStockCount` must be org-wide regardless of filters — so it needs its own query. DB queries: **1 aggregation** instead of full scan.

**Problem 2 — in-memory sort + cursor pagination:** `paginateRows` uses `Array.findIndex` (O(N)) to locate the cursor after loading all rows. Combined with in-memory sort, this means N rows are always materialised in Node.js even when only `limit` (e.g. 50) are returned.

**Proposed fix for `getLevels`:** Use `this.prismaService.paginateMany`, which already exists and handles DB-level `orderBy`, `take`, `cursor/skip`, and a parallel `count` call. This replaces `sortInventoryLevelRows` + `paginateRows` entirely:

```ts
const { data, total, nextCursor } = await this.prismaService.paginateMany(
  this.prismaService.inventoryLevel,
  { where, include: { product: true, location: true } },
  { limit, cursor, sortBy, sortOrder, orderBy: buildLevelOrderBy(sortBy) },
);
```

`paginateMany` requires mapping the `sortBy` string to a `PaginationOrderByInput` shape that the helper understands — look at how `order.service.ts` or `customer.service.ts` call it for the exact pattern.

---

### `getInventory` / `getAggregatedInventorySnapshot`

Same root cause as `getLevels`: all products loaded, sorted in memory, cursor scanned with `findIndex`.

**Proposed fix:** Push `lowStockOnly` filter, sorting, and pagination into SQL using a `$queryRaw` that does the `SUM(quantity)` aggregation with a proper `WHERE`, `ORDER BY`, `LIMIT`, and cursor condition. This is the most complex refactor but has the highest payoff for large catalogs.

Alternatively, as a cheaper intermediate step: add `take`/`skip` at the `product.findMany` level (requires stable sort key) and accept that sorting by `stockGap` or `totalQuantity` still requires in-memory work — but at least simple cases (default sort by name) become efficient.

---

### `createLevel` — 2 sequential DB queries

```ts
const product  = await prisma.product.findFirst(...)    // query 1
const location = await prisma.location.findFirst(...)   // query 2
return prisma.inventoryLevel.create(...)                // query 3
```

**Problem:** Product and location lookups are independent but run sequentially.

**Proposed fix:** Run them in parallel with `Promise.all`, then proceed to `create`:

```ts
const [product, location] = await Promise.all([
  this.prismaService.product.findFirst({ where: { id: data.productId, organizationId } }),
  this.prismaService.location.findFirst({ where: { id: data.locationId, organizationId } }),
]);
```

Latency reduction: 2 round-trips → 1 round-trip + 1 create.

---

### `createAdjustmentWithTx` — findFirst + conditional create + update (2–3 sequential queries)

```ts
let level = await tx.inventoryLevel.findFirst(...)   // query 1
if (!level) level = await tx.inventoryLevel.create(...)  // query 2 (conditional)
await tx.inventoryLevel.update(...)                  // query 3
await tx.inventoryAdjustment.create(...)             // query 4
```

**Problem:** The find-or-create pattern adds an extra round-trip on the first adjustment for a product/location pair.

**Proposed fix:** Use `upsert` to collapse queries 1–2 into one:

```ts
const level = await tx.inventoryLevel.upsert({
  where: { productId_locationId: { productId: data.productId, locationId: data.locationId } },
  create: { productId: data.productId, locationId: data.locationId, quantity: 0 },
  update: {},  // just fetch existing; quantity update follows below
});
```

This requires a `@@unique([productId, locationId])` constraint in the Prisma schema (check `schema.prisma` — if not present, add it as part of this fix). Queries: 3 instead of 3–4, and the conditional branch is eliminated.

---

### `updateLevel` / `deleteLevel` — findFirst + update/delete (2 queries each)

```ts
const existing = await prisma.inventoryLevel.findFirst(...)  // query 1
if (!existing) throw NotFoundException
return prisma.inventoryLevel.update/delete(...)              // query 2
```

**Proposed fix:** Use `update`/`delete` directly and catch Prisma error `P2025` (record not found):

```ts
try {
  return await this.prismaService.inventoryLevel.update({
    where: { id, product: { organizationId }, location: { organizationId } },
    data,
  });
} catch (e) {
  if (e?.code === 'P2025') throw new NotFoundException('Inventory level not found');
  throw e;
}
```

1 query instead of 2 per operation.

---

## Priority Summary

| Method | Current queries | Proposed queries | Impact |
|--------|----------------|-----------------|--------|
| `getLowStockProductCount` | 1 full scan | 1 count aggregation | High — called per dashboard load |
| `getLevels` (`orgWideLevels`) | 3 (1 full scan) | 2 + 1 count aggregation | High — full scan on every page |
| `getLevels` sorting/pagination | in-memory O(N) | DB-level | Medium — depends on catalog size |
| `getInventory` / snapshot | 1 full scan | DB-level aggregation | High — deferred (complex) |
| `createLevel` | 3 sequential | 2 parallel + 1 | Low — write path, rare |
| `createAdjustmentWithTx` | 3–4 sequential | 3 (upsert) | Low — write path |
| `updateLevel` / `deleteLevel` | 2 each | 1 each | Low — write path |

## Files to Modify

- `backend/src/domain/inventory/inventory.service.ts` — all changes above
- `backend/prisma/schema.prisma` — add `@@unique([productId, locationId])` on `InventoryLevel` if missing (needed for `upsert`)
- `backend/prisma/migrations/` — new migration for the unique constraint if added

## Verification

1. `pnpm test` in `backend/` — existing inventory service tests should still pass
2. Manual: `GET /inventory` and `GET /inventory/levels` return identical results before and after
3. Manual: `POST /inventory/adjustments` on a new product/location pair creates the level correctly via upsert
4. Check query count with Prisma's `$on('query')` event or `DEBUG=prisma:query` to confirm reduction
