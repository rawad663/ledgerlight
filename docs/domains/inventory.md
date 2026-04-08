# Inventory

## Purpose and module boundaries

The inventory domain tracks quantity on hand by product and location, exposes aggregated low-stock views, and records auditable stock adjustments.

This doc covers:

- Backend `inventory` under `backend/src/domain/inventory`
- Frontend inventory page and stock-adjustment UI under `/inventory`

## Main entities and state

- Inventory level by product and location
- Aggregated product inventory totals
- Reorder threshold and stock gap
- Inventory adjustment events

## Backend behavior

### Endpoints

- `GET /inventory`
  - aggregated product-level inventory with location breakdowns
- `GET /inventory/levels`
  - paginated inventory levels with product and location details
  - supports `productId`, `locationId`, `search`, and `lowStockOnly`
- `POST /inventory/adjustments`
  - creates an auditable stock delta for a product at a location

### Permissions

- Read: `INVENTORY_READ`
- Adjust stock: `INVENTORY_ADJUST`

### Business rules and edge cases

- Inventory is organization-scoped and respects location restrictions.
- Low-stock views compare quantity on hand against each product's reorder threshold.
- Negative adjustments cannot drive stock below zero.
- Adjustments fail when the referenced product or location is invalid for the current organization or scope.
- Direct CRUD for inventory levels is intentionally not exposed; inventory changes should flow through adjustments or coordinated product creation.

## Frontend behavior

### Pages and data loading

- `/inventory` server-loads `/inventory/levels`.
- Initial query params support:
  - `search`
  - `location` or `locationId`
  - `lowStockOnly`

### Main UI flows

- Search and location filtering refine the visible level list.
- Low-stock mode highlights the subset that needs replenishment.
- The page exposes a stock-adjustment flow for restocks and reductions.
- Successful adjustments refresh visible quantities.
- Backend validation failures are surfaced to the user instead of silently swallowed.

## Permissions and access

- Frontend route access requires an authenticated session.
- Final authorization for reads and adjustments is still owned by backend permissions.

## Testing coverage

- Backend inventory behavior is covered by service/controller tests and backend integration tests in `backend/test/integration/inventory.integration-spec.ts`.
- Frontend inventory behavior is covered by Playwright page-level tests in `frontend/test/integration/specs/inventory.integration.spec.ts`.
