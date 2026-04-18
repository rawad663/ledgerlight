# Order

## Purpose and module boundaries

The order domain owns sales orders and line items. It is responsible for order
creation, metadata updates, item mutations while an order is still editable, and
the fulfillment-oriented order lifecycle.

This doc covers:

- Backend `order` module under `backend/src/domain/order`
- Frontend order list and order detail flows under `frontend/app/orders` and
  `frontend/components/orders`
- The order-facing parts of the payments integration where order state and
  payment state interact

## Data model

### Core entities

- `Order`
- `OrderItem`
- Related `Customer`, `Location`, `Product`, and `Payment`

### Order status lifecycle

`OrderStatus` is now fulfillment-only:

- `PENDING`
- `CONFIRMED`
- `FULFILLED`
- `CANCELLED`

`REFUNDED` is no longer an order status. Refund outcomes live on the payment.

### Payment relationship

- `PENDING` orders do not have a payment row.
- The first `PENDING -> CONFIRMED` transition creates the single `Payment` row
  in the same database transaction as the status change.
- `OrderDto` and `OrderListItemDto` both expose a nullable `payment` summary.
- The summary includes `method`, `paymentStatus`, `refundStatus`,
  `financialStatus`, `amountCents`, `currencyCode`, `paidAt`,
  `refundRequestedAt`, and `refundedAt`.
- `financialStatus` is derived from payment state. Current UI values are:
  `NO_PAYMENT`, `UNPAID`, `PAYMENT_PENDING`, `PAYMENT_FAILED`, `PAID`,
  `REFUND_REQUESTED`, `REFUND_PENDING`, `REFUND_FAILED`, `REFUNDED`.

## Backend behavior

### Endpoints

- `GET /orders`
  - paginated list
  - supports search, status, location, and optional `withItems`
  - returns payment summaries on each row
- `GET /orders/:id`
  - single order
  - supports optional `withItems`
  - returns a payment summary alongside the order
- `POST /orders`
  - creates a `PENDING` order and its initial items
  - does not create a payment row
- `PATCH /orders/:id`
  - updates order metadata only
- `DELETE /orders/:id`
  - deletes the order
- `POST /orders/:id/transition-status`
  - performs allowed status transitions
- `POST /orders/:id/items`
  - adds an item to a `PENDING` order
- `DELETE /orders/:id/items/:itemId`
  - removes an item from a `PENDING` order

### Permissions

- Read: `ORDERS_READ`
- Create: `ORDERS_CREATE`
- Update metadata/items: `ORDERS_UPDATE`
- Delete: `ORDERS_DELETE`
- Status transitions:
  - confirm: `ORDERS_TRANSITION_CONFIRM`
  - fulfill: `ORDERS_TRANSITION_FULFILL`
  - cancel: `ORDERS_TRANSITION_CANCEL`
  - reopen: `ORDERS_TRANSITION_REOPEN`

### State transitions and rules

- `PENDING -> CONFIRMED`
  - sets `placedAt` if missing
  - creates the payment row with `paymentStatus=UNPAID`,
    `refundStatus=NONE`, `currencyCode='CAD'`, and `amountCents=order.totalCents`
- `CONFIRMED -> FULFILLED`
  - requires an associated payment
  - requires `payment.paymentStatus=PAID`
  - requires `payment.refundStatus=NONE`
- `PENDING -> CANCELLED`
  - allowed without any payment row
- `CONFIRMED -> CANCELLED`
  - allowed only if the order is not paid and no refund is in progress
  - any active card attempt is canceled before the order is marked cancelled
- `CANCELLED -> PENDING`
  - allowed only when the payment is not paid or refunded and no refund is in progress
  - any active card attempt is voided
  - the unpaid or failed payment row and all attempts are deleted before the order returns to `PENDING`

### Item mutation rules

- Orders must contain at least one item on creation.
- Item quantity must be positive.
- Discount and tax values must be non-negative.
- Discount cannot exceed the line subtotal.
- Only `PENDING` orders allow item add/remove mutations.
- Because payments are only created on confirmation, `PENDING` item changes never
  need to synchronize `payment.amountCents`.

### Multi-tenant and scoped access rules

- Every query is organization-scoped.
- Location-restricted memberships are filtered with the shared location-scope helpers.
- Scoped members cannot mutate or read orders outside their allowed locations.

### Legacy compatibility

The order service can lazily backfill missing legacy payment rows when an older
non-`PENDING` order is read or transitioned. This keeps pre-payments data usable
while the migration normalizes historical state.

## Frontend behavior

### Orders list

- `/orders` still supports search, location filtering, sorting, and order-status filtering.
- The `Refunded` order-status filter is gone because refunds are no longer an order state.
- The list now includes a payment / financial status column.

### Order detail

- The header shows order status and financial status side by side.
- The detail page displays a dedicated payment status card.
- Available actions are derived from both order state and financial state:
  - `Process Payment` for confirmed unpaid or payment-failed orders
  - `Resume Payment` for confirmed payment-pending orders
  - `Refund` for paid orders with no active refund flow
  - `Retry Refund` for refund-failed orders
  - `Fulfill Order` only after payment is fully paid
- The process-payment modal keeps its header and close action anchored while the payment body scrolls, so expanded Stripe card and address fields do not hide the submission controls.
- The audit timeline merges `ORDER` and `PAYMENT` audit events so payment changes
  appear in the same detail experience.

## Business rules and edge cases

- A confirmed order cannot be fulfilled until payment succeeds.
- Paid orders must be refunded through the payment flow instead of being cancelled directly.
- Orders with refund status `REQUESTED` or `PENDING` cannot be fulfilled, cancelled, or reopened.
- Cancelled orders that were never confirmed can exist without a payment row.
- Reopening a cancelled unpaid order intentionally discards its old payment state so
  the order can be edited again with a fresh payment created on the next confirmation.

## Testing coverage

- Backend service/controller coverage lives in `backend/src/domain/order/`.
- Backend integration coverage lives in
  `backend/test/integration/order.integration-spec.ts`.
- Frontend page-level coverage lives in
  `frontend/test/integration/specs/orders.integration.spec.ts`.
