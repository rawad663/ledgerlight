# Payment

## Purpose and module boundaries

The payment domain owns payment collection, card retry state, refunds, Stripe
webhook synchronization, and the payment summaries shown from the orders UI.

This doc covers:

- Backend `payment` module under `backend/src/domain/payment`
- Stripe integration under `backend/src/infra/stripe`
- Frontend payment flows embedded in the orders experience

## Data model

### Entities

- `Payment`
  - one-to-one with `Order`
  - created when an order transitions from `PENDING` to `CONFIRMED`
- `PaymentAttempt`
  - one-to-many under `Payment`
  - stores Stripe PaymentIntent history for card retries
- `StripeWebhookReceipt`
  - stores processed Stripe event ids so webhook replays are ignored safely

### Payment fields

`Payment` stores:

- `method`: `CARD` or `CASH`
- `paymentStatus`: `UNPAID`, `PENDING`, `FAILED`, `PAID`
- `refundStatus`: `NONE`, `REQUESTED`, `PENDING`, `FAILED`, `REFUNDED`
- `amountCents`
- `currencyCode`
- `paidAt`
- `refundRequestedAt`
- `refundedAt`
- `refundFailedAt`
- `refundReason`
- `lastPaymentFailure`
- `lastRefundFailure`
- `stripeRefundId`

### Financial status

The API does not persist a separate `financialStatus`. It derives one from
`paymentStatus` and `refundStatus` for frontend use:

- `NO_PAYMENT`
- `UNPAID`
- `PAYMENT_PENDING`
- `PAYMENT_FAILED`
- `PAID`
- `REFUND_REQUESTED`
- `REFUND_PENDING`
- `REFUND_FAILED`
- `REFUNDED`

### Currency and payment methods

- Currency is currently hardcoded to `CAD`.
- Stripe is card-only in v1.
- Partial refunds and non-card Stripe payment methods are out of scope.

## Backend behavior

### Endpoints

- `GET /payments/:orderId`
  - returns the current payment plus latest card-attempt summary
  - permission: `PAYMENTS_READ`
- `POST /payments/:orderId/card`
  - starts or resumes a card payment
  - permission: `PAYMENTS_CREATE`
- `POST /payments/:orderId/card/confirm`
  - fetches the latest Stripe PaymentIntent state and syncs it idempotently
  - permission: `PAYMENTS_CREATE`
- `POST /payments/:orderId/cash`
  - marks a confirmed order as cash-paid
  - permission: `PAYMENTS_CREATE`
- `POST /payments/:orderId/refund`
  - requests a full refund and requires a non-empty `refundReason`
  - permission: `PAYMENTS_REFUND`
- `POST /payments/webhooks/stripe`
  - internal Stripe webhook endpoint
  - validates the webhook signature with the raw request body

### Payment creation

- `POST /orders` does not create a payment.
- `POST /orders/:id/transition-status` with `toStatus=CONFIRMED` creates the payment row
  inside the same transaction as the order status change.
- Legacy non-`PENDING` orders without payment rows are lazily backfilled on read or mutation.

### Card collection and retry behavior

- Only `CONFIRMED` orders can accept payments.
- If the latest `PaymentAttempt` is still active (`PENDING` or `REQUIRES_ACTION`),
  `POST /payments/:orderId/card` returns the existing `clientSecret` instead of creating a duplicate attempt.
- If the latest attempt is terminal (`FAILED` or `CANCELED`), the same endpoint creates a new Stripe PaymentIntent
  and a new `PaymentAttempt`.
- Successful confirmation moves the payment to `PAID`.
- Processing or action-required states keep the payment in `PENDING`.
- Failed or canceled attempts move the payment to `FAILED` and store the latest Stripe failure text for the retry UI.

### Stripe source of truth and idempotency

- Stripe is the source of truth for card and card-refund outcomes.
- The explicit confirm endpoint and the webhook handlers both map Stripe state back into the same payment records.
- Repeated confirm calls and repeated webhook deliveries are safe:
  - payment state updates are no-ops when nothing changes
  - `StripeWebhookReceipt` prevents duplicate webhook processing
  - audit logs are only written for real state transitions

### Cash payments

- `POST /payments/:orderId/cash` is only valid for confirmed orders.
- Cash payment cannot be recorded while a card payment is still pending.
- Cash payment marks the payment as `PAID` immediately and does not create any `PaymentAttempt` rows.

### Refund rules

- Full refunds only.
- `refundReason` is required.
- Only paid `CONFIRMED` and paid `FULFILLED` orders can be refunded.
- Refund flow states:
  - `REQUESTED`
  - `PENDING`
  - `FAILED`
  - `REFUNDED`
- Cash refunds complete synchronously.
- Card refunds are synchronized with Stripe and can remain pending or fail.
- A successful refund changes order state like this:
  - paid `CONFIRMED` order -> `CANCELLED`
  - paid `FULFILLED` order -> remains `FULFILLED`
- While refund status is `REQUESTED` or `PENDING`, the order cannot be fulfilled,
  cancelled, reopened, or refunded again.

## Frontend behavior

### Orders UI integration

- Orders list shows a financial-status badge derived from the payment summary.
- Order detail shows:
  - order status
  - financial status
  - payment method
  - amount
  - currency
  - paid / refund timestamps
- The payment dialog supports:
  - cash payment
  - Stripe PaymentElement for card-only collection
  - resume of active card attempts
  - retry after failed card attempts
- The refund dialog requires a reason and surfaces pending, failed, and refunded states.

## Permission model

- `PAYMENTS_READ`
  - all payment reads
- `PAYMENTS_CREATE`
  - start/resume card payment
  - confirm card payment
  - mark cash paid
- `PAYMENTS_REFUND`
  - request or retry refunds

Owners have wildcard access. Managers have full payment access. Cashiers can read
payments and collect them, but cannot refund. Support is read-only.

## Testing coverage

- Backend unit coverage lives in `backend/src/domain/payment/`.
- Dedicated Stripe wrapper coverage lives in
  `backend/src/infra/stripe/stripe.service.spec.ts`.
- Backend integration coverage lives in
  `backend/test/integration/payment.integration-spec.ts`.
- Frontend payment behavior is covered through the orders integration flow in
  `frontend/test/integration/specs/orders.integration.spec.ts`.
