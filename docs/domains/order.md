# Order

## Purpose and module boundaries

The order domain owns sales orders and their line items, including creation, metadata updates, status transitions, and item-level mutations.

This doc covers:

- Backend `order` under `backend/src/domain/order`
- Frontend order list and order detail flows under `/orders`

## Main entities and state

- `Order`
- `OrderItem`
- Order status lifecycle:
  - `PENDING`
  - `CONFIRMED`
  - `FULFILLED`
  - `CANCELLED`
  - `REFUNDED`
- Related customer, location, product, and audit-log data

## Transitioning Order Status
```
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  CONFIRMED: [OrderStatus.FULFILLED, OrderStatus.CANCELLED],
  CANCELLED: [OrderStatus.PENDING], // re-open
  FULFILLED: [OrderStatus.REFUNDED],
  REFUNDED: [],
};
```

## Backend behavior

### Endpoints

- `GET /orders`
  - paginated list
  - supports search, status, location, and optional `withItems`
- `GET /orders/:id`
  - individual order
  - supports optional `withItems`
- `POST /orders`
  - creates an order and its initial items together
- `PATCH /orders/:id`
  - updates order metadata only
- `DELETE /orders/:id`
  - removes the order according to service rules
- `POST /orders/:id/transition-status`
  - transitions to a target status
- `POST /orders/:id/items`
  - adds an item to an existing order
- `DELETE /orders/:id/items/:itemId`
  - removes an existing order item

### Permissions

- Read: `ORDERS_READ`
- Create: `ORDERS_CREATE`
- Update metadata/items: `ORDERS_UPDATE`
- Delete: `ORDERS_DELETE`
- Status transitions use specific permissions:
  - confirm: `ORDERS_TRANSITION_CONFIRM`
  - fulfill: `ORDERS_TRANSITION_FULFILL`
  - cancel: `ORDERS_TRANSITION_CANCEL`
  - reopen: `ORDERS_TRANSITION_REOPEN`
  - refund: `ORDERS_TRANSITION_REFUND`

### Business rules and edge cases

- Orders are organization-scoped and respect location restrictions.
- Creating an order requires at least one item.
- Customer, location, and products must belong to the current organization and be valid for use.
- Item quantities must be positive.
- Discount values cannot exceed the line subtotal.
- Status transitions are validated against the current order state and the caller's permissions.
- Order mutations write audit records that later appear on the detail page.

## Frontend behavior

### Pages and data loading

- `/orders` server-loads the initial paginated order list.
- `/orders/[id]` server-loads:
  - the order with items
  - the matching audit-log timeline filtered by `entityType=ORDER`

### Main UI flows

- The orders index supports search, status filtering, location filtering, and sort controls.
- Users can create an order from the orders page.
- The detail page supports editing order metadata, changing status, adding items, and deleting items.
- Invalid item mutations or invalid transitions are surfaced as user-visible errors.

## Testing coverage

- Backend order behavior is covered by service/controller tests and backend integration tests in `backend/test/integration/order.integration-spec.ts`.
- Frontend order behavior is covered by Playwright page-level tests in `frontend/test/integration/specs/orders.integration.spec.ts`.
