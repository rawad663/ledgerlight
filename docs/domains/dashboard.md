# Dashboard

## Purpose and module boundaries

The dashboard domain provides the owner and manager home experience: KPI cards, sales overview, recent orders, and the low-stock watchlist.

This doc covers:

- Backend `dashboard` under `backend/src/domain/dashboard`
- Frontend dashboard route at `/`

## Main entities and state

- Summary metrics derived from orders, customers, and inventory
- Sales timeline buckets for day, week, or month views
- Recent orders preview
- Low-stock inventory preview

## Backend behavior

### Endpoints

- `GET /dashboard/summary`
- `GET /dashboard/sales-overview`
  - accepts `timeline`
  - accepts optional `anchor`

### Permissions

Both endpoints require the combined ability to read the underlying operational data:

- `ORDERS_READ`
- `CUSTOMERS_READ`
- `INVENTORY_READ`
- `REPORTS_READ`

### Business rules and edge cases

- Metrics are organization-scoped and respect resolved location scope.
- Sales metrics are derived from finalized order states rather than every raw order row.
- Timeline output is bucketed by calendar period.

## Frontend behavior

### Pages and data loading

- `/` performs server-side loading of:
  - `/dashboard/summary`
  - `/dashboard/sales-overview`
  - `/orders` for recent orders
  - `/inventory` with `lowStockOnly=true` for the watchlist
- The page uses `Suspense` with a dashboard skeleton fallback.

### Access rules

- Frontend role gating is explicit: only `OWNER` and `MANAGER` can access the dashboard route.
- Other authenticated users are redirected from `/` to `/products`.

### Main UI flows

- Summary cards render the current KPI snapshot.
- Sales overview can switch timeline views and re-request data client-side.
- Recent orders link into the orders index with matching query params.
- Low-stock entries link into `/inventory?lowStockOnly=true`.
- If an individual data request fails, the page shows the corresponding fallback message instead of collapsing the whole view.

## Testing coverage

- Backend dashboard behavior is covered by service/controller tests and backend integration tests in `backend/test/integration/dashboard.integration-spec.ts`.
- Frontend dashboard behavior is covered by Playwright page-level tests in `frontend/test/integration/specs/dashboard.integration.spec.ts`.
- Focused rendering behavior is also covered in `frontend/components/dashboard/dashboard-page.test.tsx` and `frontend/components/dashboard/sales-overview-card.test.tsx`.
