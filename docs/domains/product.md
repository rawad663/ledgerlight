# Product

## Purpose and module boundaries

The product domain manages the sellable catalog, including SKU uniqueness, category filtering, and the inventory coupling that happens when products are created.

This doc covers:

- Backend `product` under `backend/src/domain/product`
- Frontend product management under `/products`

## Main entities and state

- `Product`
- SKU
- Category
- Price in integer cents
- Reorder threshold used by inventory low-stock logic

## Backend behavior

### Endpoints

- `GET /products`
  - paginated list with search and category filters
- `GET /products/:id`
  - individual product detail
- `POST /products`
  - creates a product
- `PATCH /products/:id`
  - updates product fields
- `DELETE /products/:id`
  - archive/delete path used to retire a product

### Permissions

- Read: `PRODUCTS_READ`
- Create: `PRODUCTS_CREATE`
- Update: `PRODUCTS_UPDATE`
- Archive/delete: `PRODUCTS_ARCHIVE`

### Business rules and edge cases

- All product queries are organization-scoped.
- Duplicate SKU creation is rejected.
- Prices and totals are represented as integer cents, never floats.
- Product creation participates in the broader inventory model so a product can be tracked immediately in inventory flows.

## Frontend behavior

### Pages and data loading

- `/products` server-loads the first product page and category options.

### Main UI flows

- Search and category filtering refine the visible catalog.
- Create product supports the initial inventory-aware setup expected by the app.
- Edit product updates an existing product in place.
- Delete/archive removes the product from active use in the UI.
- Duplicate SKU conflicts are shown to the user.

## Testing coverage

- Backend product behavior is covered by service/controller tests and backend integration tests in `backend/test/integration/product.integration-spec.ts`.
- Frontend product behavior is covered by Playwright page-level tests in `frontend/test/integration/specs/products.integration.spec.ts`.
