# Stripe Payments Integration for POS

## Context

The POS currently models orders and totals in cents but has no payment processing. We're adding Stripe-powered payments where demo environments use Stripe test keys (`sk_test_...`) and production uses live keys (`sk_live_...`) — no additional `PAYMENT_MODE` flag is needed since Stripe's key prefix controls sandbox vs. live automatically.

Two payment methods are supported:
- **Card** via Stripe Payment Intents + Stripe Elements (frontend card collection)
- **Cash** via a manual "Mark as Paid" flow (no Stripe involvement)

Refunds use Stripe's Refund API for card payments and a direct DB update for cash.

**On `REFUNDED` in `OrderStatus`:** Remove it. Order status tracks the fulfillment lifecycle; payment status tracks the money lifecycle. A refunded order was still delivered (stays `FULFILLED`) — the refund is a payment event, not a fulfillment event. This is consistent with how Stripe/Shopify model it. The `ORDERS_TRANSITION_REFUND` permission is removed and replaced by `PAYMENTS_REFUND`.

New order status lifecycle: `PENDING → CONFIRMED → FULFILLED → CANCELLED` (`CANCELLED → PENDING` for reopen). `FULFILLED` becomes a terminal order state.

---

## Schema Changes

**File:** `backend/prisma/schema.prisma`

1. **Add enums:**
   ```prisma
   enum PaymentStatus {
     UNPAID
     PAID
     REFUNDED
   }

   enum PaymentMethod {
     CARD
     CASH
   }
   ```

2. **Add `Payment` model** (1:1 with Order):
   ```prisma
   model Payment {
     id             String        @id @default(uuid())
     organizationId String
     orderId        String        @unique

     method         PaymentMethod
     status         PaymentStatus @default(UNPAID)
     amountCents    Int

     stripePaymentIntentId String? @unique @db.VarChar(100)
     stripeRefundId        String? @unique @db.VarChar(100)

     paidAt     DateTime?
     refundedAt DateTime?

     createdAt DateTime @default(now())
     updatedAt DateTime @updatedAt

     organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
     order        Order        @relation(fields: [orderId], references: [id], onDelete: Cascade)

     @@index([organizationId, createdAt])
     @@index([organizationId, status])
   }
   ```

3. **Add `payments` relation to `Order` model.**

4. **Remove `REFUNDED` from `OrderStatus` enum.**  
   Migration must handle existing `REFUNDED` orders: update them to `FULFILLED` and create a corresponding `Payment` record with `status = REFUNDED`.

5. **Update `AuditEntityType`:** add `PAYMENT`

6. **Update `AuditAction`:** add `PAYMENT_CREATED`, `PAYMENT_REFUNDED`

7. **Run migration:** `make migrate` (or `npx prisma migrate dev --name add-payments`)

8. **Update `createPrismaMock`** in `backend/src/test-utils/prisma.mock.ts` to add `payment` model mock.

---

## Backend

### Infra — Stripe Client
**New files:**
- `backend/src/infra/stripe/stripe.module.ts` — exports `StripeService`, `global: true`
- `backend/src/infra/stripe/stripe.service.ts` — wraps Stripe SDK:
  - `createPaymentIntent(amountCents, currency)` → `Stripe.PaymentIntent`
  - `retrievePaymentIntent(id)` → `Stripe.PaymentIntent`
  - `createRefund(paymentIntentId)` → `Stripe.Refund`
  - `constructWebhookEvent(payload, signature)` → `Stripe.Event`
  - Uses `configService.getOrThrow('STRIPE_SECRET_KEY')` at construction

**Install:** `stripe` npm package in backend.

**Register** `StripeModule` in `backend/src/app.module.ts`.

---

### Permissions
**File:** `backend/src/common/permissions/permissions.ts`

Add:
```typescript
PAYMENTS_READ:   'payments.read',
PAYMENTS_CREATE: 'payments.create',
PAYMENTS_REFUND: 'payments.refund',
```

Remove: `ORDERS_TRANSITION_REFUND`

**File:** `backend/src/common/permissions/role-permissions.ts`

| Role             | Change |
|------------------|--------|
| MANAGER          | replace `ORDERS_TRANSITION_REFUND` with `PAYMENTS_READ`, `PAYMENTS_CREATE`, `PAYMENTS_REFUND` |
| CASHIER          | remove `ORDERS_TRANSITION_REFUND` (they had it? — check file); add `PAYMENTS_CREATE`, `PAYMENTS_READ` |
| SUPPORT          | add `PAYMENTS_READ` |
| INVENTORY_CLERK  | no payment permissions |
| OWNER            | wildcard covers all |

---

### Order Domain Updates
**File:** `backend/src/domain/order/order.service.ts`

Remove from `ALLOWED_TRANSITIONS`:
```typescript
FULFILLED: [OrderStatus.REFUNDED],  // → FULFILLED: []
REFUNDED: [],                        // → remove entirely
```
Remove the `REFUNDED` case from the `switch` in `transitionStatus`.

**File:** `backend/src/domain/order/order.controller.ts`

Remove from `TRANSITION_PERMISSION`:
```typescript
[OrderStatus.REFUNDED]: Permission.ORDERS_TRANSITION_REFUND,
```
Remove `ORDERS_TRANSITION_REFUND` from `@RequireAnyPermission(...)`.

**File:** `backend/src/domain/order/order.dto.ts`

`OrderDto` should include a nested `payment` summary (optional, for detail view):
```typescript
@ValidateNested()
@Type(() => PaymentSummaryDto)
@IsOptional()
payment?: PaymentSummaryDto | null;
```

`PaymentSummaryDto` (defined in payment.dto.ts, imported here):
```typescript
{ id, status, method, amountCents, paidAt, refundedAt }
```

Update `getOrderById` in service to `include: { items: true, payment: true }`.

**Files to update (tests):**
- `backend/src/domain/order/order.service.spec.ts` — remove REFUNDED transition test cases
- `backend/src/domain/order/order.controller.spec.ts` — remove `CASHIER cannot refund` test, update `FULFILLED: []` transition assertions

---

### Payment Domain (New)
**New directory:** `backend/src/domain/payment/`

#### `payment.dto.ts`
- `PaymentDto` — full payment record shape (id, orderId, method, status, amountCents, stripePaymentIntentId, paidAt, refundedAt, createdAt)
- `PaymentSummaryDto` — subset for embedding in OrderDto
- `CreateCardPaymentResponseDto` — `{ paymentId, clientSecret }` (returned after PaymentIntent creation)

#### `payment.service.ts`
Key methods:

**`initiateCardPayment(org, orderId)`**
1. Verify order exists, belongs to org, is `CONFIRMED`, has no existing payment
2. Create Stripe `PaymentIntent` with `order.totalCents`
3. Create `Payment` record with `method=CARD, status=UNPAID, stripePaymentIntentId`
4. Write audit log: `PAYMENT_CREATED`
5. Return `{ paymentId, clientSecret }`

**`confirmCardPayment(org, orderId)`**
1. Retrieve `Payment` record for orderId
2. Retrieve `PaymentIntent` from Stripe
3. If `status === 'succeeded'`: update Payment to `PAID`, set `paidAt`
4. Write audit log update
5. Return updated `PaymentDto`

**`markCashPaid(org, orderId)`**
1. Verify order is `CONFIRMED`, no existing payment
2. Create `Payment` with `method=CASH, status=PAID, paidAt=now()`
3. Write audit log: `PAYMENT_CREATED`
4. Return `PaymentDto`

**`refundPayment(org, orderId)`**
1. Verify order is `FULFILLED`, payment is `PAID`
2. If `method=CARD`: call `stripeService.createRefund(stripePaymentIntentId)`, store `stripeRefundId`
3. Update Payment: `status=REFUNDED, refundedAt=now()`
4. Write audit log: `PAYMENT_REFUNDED`
5. Return `PaymentDto`

**`getPaymentByOrderId(org, orderId)`**
- Scoped query by `organizationId`

#### `payment.controller.ts`
All routes under `@Controller('payments')`, `@OrgProtected()`:

| Method | Path | Permission | Calls |
|--------|------|-----------|-------|
| `POST` | `/:orderId/card` | `PAYMENTS_CREATE` | `initiateCardPayment` |
| `POST` | `/:orderId/card/confirm` | `PAYMENTS_CREATE` | `confirmCardPayment` |
| `POST` | `/:orderId/cash` | `PAYMENTS_CREATE` | `markCashPaid` |
| `POST` | `/:orderId/refund` | `PAYMENTS_REFUND` | `refundPayment` |
| `GET`  | `/:orderId` | `PAYMENTS_READ` | `getPaymentByOrderId` |

#### `stripe-webhook.controller.ts`
Separate controller, **no** `@OrgProtected()` guard:
- `POST /stripe/webhook` — public, verifies Stripe signature
- Handles `payment_intent.succeeded` → calls `paymentService.handleWebhookPaymentSucceeded(event)`
- Handles `charge.refund.updated` → calls `paymentService.handleWebhookRefundUpdated(event)`

**File:** `backend/src/main.ts`
Add raw body middleware before global pipes (needed for Stripe signature verification):
```typescript
app.use('/stripe/webhook', express.raw({ type: 'application/json' }));
```

#### `payment.module.ts`
Imports: `PrismaModule`, `StripeModule`  
Controllers: `PaymentController`, `StripeWebhookController`  
Providers: `PaymentService`

**Register** in `backend/src/app.module.ts`.

#### Tests
- `payment.service.spec.ts` — mock `PrismaService` + `StripeService`; cover: happy path card, happy path cash, refund card, refund cash, error cases (already paid, wrong status, order not found)
- `payment.controller.spec.ts` — permission checks (CASHIER cannot refund, SUPPORT cannot create)

---

## Environment Variables

**File:** `.env.example` — add:
```
# Stripe (use sk_test_... for dev/demo, sk_live_... for production)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

`STRIPE_SECRET_KEY` should be validated at startup with `configService.getOrThrow(...)` in `StripeService` constructor (same pattern as `JWT_ACCESS_SECRET` in auth).

---

## Frontend

**Install:** `@stripe/stripe-js`, `@stripe/react-stripe-js`

**Regenerate types:** `make generate-types` (or equivalent) after OpenAPI spec is updated.

### Updated Files

**`frontend/components/orders/order-detail-page.tsx`**
- Remove `REFUNDED` entry from `transitionActions` map
- Remove "Refund Order" from transition buttons
- Add payment status badge next to order status badge
- Add "Process Payment" button when order is `CONFIRMED` and `payment === null || payment.status === 'UNPAID'`
- Add "Refund" button when payment status is `PAID`
- Wire both buttons to new dialogs

**`frontend/components/orders/orders-page.tsx` / list view**
- Add `Payment Status` column showing `UNPAID | PAID | REFUNDED` badge

**`frontend/app/orders/[id]/page.tsx`**
- Fetch includes payment data (backend now returns it in `OrderDetailDto`)

### New Components

**`frontend/components/orders/pay-order-dialog.tsx`**
- Two tabs: **Card** and **Cash**
- **Card tab:** Loads Stripe `Elements`, renders `PaymentElement`, on submit:
  1. Calls `POST /payments/:orderId/card` → gets `clientSecret`
  2. Calls `stripe.confirmPayment({ clientSecret, ... })`
  3. On success, calls `POST /payments/:orderId/card/confirm`
  4. Calls `onSuccess()` → parent refreshes
- **Cash tab:** Simple "Confirm Cash Payment" button → calls `POST /payments/:orderId/cash` → `onSuccess()`

**`frontend/components/orders/refund-order-dialog.tsx`**
- Confirmation dialog (mirrors pattern of `cancel-order-dialog.tsx`)
- On confirm: calls `POST /payments/:orderId/refund`
- On success: parent refreshes

---

## Seed File Update

**File:** `backend/prisma/seed.ts`

No new seed data needed for Payment records — demo orders remain unpaid after seed (realistic starting state). The migration script handles existing `REFUNDED` orders in the DB.

---

## Testing Plan

### Backend Unit Tests
Run: `cd backend && npm test`

#### `payment.service.spec.ts` (new)
Mock both `PrismaService` (via `createPrismaMock`) and `StripeService`.

`initiateCardPayment`:
- Creates PaymentIntent and `Payment` record for a `CONFIRMED` order with no existing payment; returns `clientSecret` and `paymentId`
- Throws `NotFoundException` when order not found
- Throws `BadRequestException` when order is not `CONFIRMED` (test with `PENDING`, `FULFILLED`)
- Throws `ConflictException` when a payment already exists for the order

`confirmCardPayment`:
- Updates payment to `PAID` and sets `paidAt` when Stripe PaymentIntent status is `succeeded`
- Writes audit log entry (`PAYMENT_CREATED` action, `PAYMENT` entity type)
- Throws `BadRequestException` when PaymentIntent status is not `succeeded`
- Throws `NotFoundException` when no payment record exists for the order

`markCashPaid`:
- Creates `Payment` with `method=CASH`, `status=PAID`, `paidAt` set; does not call StripeService
- Throws `NotFoundException` when order not found
- Throws `BadRequestException` when order is not `CONFIRMED`
- Throws `ConflictException` when payment already exists

`refundPayment` (card):
- Calls `stripeService.createRefund(stripePaymentIntentId)`, stores `stripeRefundId`, sets `status=REFUNDED` and `refundedAt`
- Writes audit log entry (`PAYMENT_REFUNDED`)
- Throws `BadRequestException` when payment status is not `PAID`
- Throws `BadRequestException` when order is not `FULFILLED`

`refundPayment` (cash):
- Does NOT call `stripeService.createRefund`; sets `status=REFUNDED` and `refundedAt`

`getPaymentByOrderId`:
- Returns payment scoped to `organizationId`
- Throws `NotFoundException` when payment not found

#### `payment.controller.spec.ts` (new)
Permission checks per role (mirrors `order.controller.spec.ts` pattern):
- CASHIER can call `initiateCardPayment` and `markCashPaid` (`PAYMENTS_CREATE`)
- CASHIER cannot call `refundPayment` → throws `ForbiddenException`
- SUPPORT can call `getPaymentByOrderId` (`PAYMENTS_READ`)
- SUPPORT cannot call `initiateCardPayment` → throws `ForbiddenException`
- INVENTORY_CLERK cannot call any payment endpoint → throws `ForbiddenException`
- MANAGER and OWNER can call all endpoints

Delegation (thin controller — one assertion per method):
- Each controller method delegates to the corresponding `paymentService` method with correct args

#### Updated: `order.service.spec.ts`
- Remove: test asserting `FULFILLED → REFUNDED` is a valid transition
- Remove: test asserting `REFUNDED` is a terminal state
- Add: test asserting `FULFILLED` has no valid transitions (empty `ALLOWED_TRANSITIONS['FULFILLED']`)

#### Updated: `order.controller.spec.ts`
- Remove: `ORDERS_TRANSITION_REFUND` permission check tests
- Remove: CASHIER/MANAGER `REFUNDED` transition tests

---

### Backend Integration Tests
Run: `cd backend && node test/run-integration-tests.js`

#### Infrastructure changes before writing tests
1. **`backend/test/integration/utils/test-prisma.ts`** — add `'"Payment"'` to the `TABLES` array (before `'"Order"'` to respect FK order)
2. **`backend/test/integration/utils/factories.ts`** — add `createOrder` factory (creates a `CONFIRMED` order) and `createPayment` factory (creates a `PAID` cash payment)
3. **`backend/test/integration/utils/create-integration-app.ts`** — accept optional `providerOverrides` so payment tests can inject a mock `StripeService` without affecting other suites
4. **`backend/test/run-integration-tests.js`** — add `STRIPE_SECRET_KEY: 'sk_test_placeholder'` to `testEnv` so `StripeService` can construct (real Stripe calls are intercepted by mock)

#### `payment.integration-spec.ts` (new)
All card-path tests override `StripeService` with a mock that returns deterministic `PaymentIntent` / `Refund` objects.

**Cash payment lifecycle:**
1. Create `CONFIRMED` order via factory
2. `POST /payments/:orderId/cash` as CASHIER → assert `201`, `status=PAID`, `method=CASH`, `paidAt` set
3. Assert `Payment` row in DB matches response
4. Assert `AuditLog` row: `action=PAYMENT_CREATED`, `entityType=PAYMENT`

**Cash refund lifecycle:**
1. Create `FULFILLED` order + `PAID` cash payment via factories
2. `POST /payments/:orderId/refund` as MANAGER → assert `200`, `status=REFUNDED`, `refundedAt` set
3. Assert `AuditLog` row: `action=PAYMENT_REFUNDED`
4. Assert calling refund again → `400 Bad Request`

**Card payment lifecycle (Stripe mocked):**
1. `POST /payments/:orderId/card` → mock returns `{ id: 'pi_test123', client_secret: 'cs_test123' }` → assert `clientSecret` in response
2. `POST /payments/:orderId/card/confirm` → mock retrieves PaymentIntent with `status: 'succeeded'` → assert `status=PAID`

**Card refund lifecycle (Stripe mocked):**
1. `FULFILLED` order + `PAID` card payment (with `stripePaymentIntentId`)
2. `POST /payments/:orderId/refund` → mock `createRefund` returns `{ id: 'refund_test123' }` → assert `stripeRefundId` stored, `status=REFUNDED`

**`GET /payments/:orderId`:**
- Returns payment for org-scoped order as SUPPORT (read-only role)
- Returns `404` for order belonging to a different org

**Permission enforcement (HTTP-level, real guard chain):**
- CASHIER calling `POST /payments/:orderId/refund` → `403`
- SUPPORT calling `POST /payments/:orderId/cash` → `403`
- Unauthenticated request (no `Authorization` header) → `401`
- Wrong org ID in header → `403`

**Error cases:**
- Pay an already-`PAID` order → `409 Conflict`
- Pay a `PENDING` order (not yet `CONFIRMED`) → `400 Bad Request`
- Refund a `UNPAID` payment → `400 Bad Request`
- Get payment for nonexistent order → `404`

#### `stripe-webhook.integration-spec.ts` (new)
Override `StripeService.constructWebhookEvent` to return a fake `payment_intent.succeeded` event.

1. Create `UNPAID` card `Payment` record in DB
2. `POST /stripe/webhook` with `stripe-signature: test` → assert `200 { received: true }`
3. Assert `Payment` updated to `PAID` in DB
4. Invalid signature → assert `400`

---

### Frontend E2E — Playwright
- **Cash payment flow:** Create order → confirm → open "Process Payment" dialog → Cash tab → "Confirm Cash Payment" → assert payment badge shows `PAID`
- **Refund flow:** From a `PAID` order detail page → click "Refund" → confirm dialog → assert payment badge shows `REFUNDED`
- **Card flow:** Use Stripe test card `4242 4242 4242 4242` in Stripe sandbox environment

### Manual Stripe Webhook Testing (dev)
- Use Stripe CLI: `stripe listen --forward-to localhost:8080/stripe/webhook`
- Trigger: `stripe trigger payment_intent.succeeded`

---

## Documentation Updates

- **New:** `docs/domains/payment.md` — purpose, entities, endpoints, permissions, business rules
- **Update:** `docs/domains/order.md` — remove `REFUNDED` from status lifecycle, note decoupled `paymentStatus`
- **Update:** `AGENTS.md` — add Payment domain to domain list, note Stripe integration

---

## Critical Files Reference

| File | Change |
|------|--------|
| `backend/prisma/schema.prisma` | Add Payment model, enums; remove REFUNDED from OrderStatus |
| `backend/src/infra/stripe/stripe.service.ts` | New — Stripe SDK wrapper |
| `backend/src/common/permissions/permissions.ts` | Add PAYMENTS_*, remove ORDERS_TRANSITION_REFUND |
| `backend/src/common/permissions/role-permissions.ts` | Update per-role payment permissions |
| `backend/src/domain/order/order.service.ts` | Remove REFUNDED from state machine |
| `backend/src/domain/order/order.controller.ts` | Remove REFUNDED transition wiring |
| `backend/src/domain/payment/payment.service.ts` | New — payment business logic |
| `backend/src/domain/payment/payment.controller.ts` | New — payment API endpoints |
| `backend/src/domain/payment/stripe-webhook.controller.ts` | New — Stripe webhook handler |
| `backend/src/app.module.ts` | Register PaymentModule, StripeModule |
| `backend/src/main.ts` | Add raw body middleware for /stripe/webhook |
| `frontend/components/orders/order-detail-page.tsx` | Remove REFUNDED action, add payment UI |
| `frontend/components/orders/pay-order-dialog.tsx` | New — card/cash payment dialog |
| `frontend/components/orders/refund-order-dialog.tsx` | New — refund confirmation dialog |
| `.env.example` | Add Stripe env vars |
| `docs/domains/payment.md` | New domain doc |
