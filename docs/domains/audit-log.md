# Audit Log

## Purpose and module boundaries

The audit-log domain provides organization-scoped read access to the audit entries produced by write operations in other domains. It is currently a backend-only feature area; the frontend consumes audit logs inside specific flows such as order detail rather than through a dedicated top-level page.

## Main entities and state

- `AuditLog`
- Actor metadata
- `entityType`
- `entityId`
- `action`
- Optional `beforeJson` and `afterJson` snapshots
- Request metadata such as IP, user agent, and request id when available

Current high-signal entity types consumed by the UI include:

- `ORDER`
- `PAYMENT`

## Backend behavior

### Endpoints

- `GET /audit-logs`
  - paginated list of audit entries for the active organization
  - supports `entityType`
  - supports `entityId`

### Permissions

- Read: `AUDIT_LOGS_READ`

### Business rules and edge cases

- Every query is organization-scoped.
- Filtering can narrow results to a single entity type or entity id.
- Entries include lightweight actor information when available.
- The module is read-only; writes come from other domains that emit audit records during mutations.
- Payment writes now emit their own audit records. Current payment actions are:
  - `PAYMENT_CREATED`
  - `PAYMENT_ATTEMPT_STARTED`
  - `PAYMENT_PAID`
  - `PAYMENT_FAILED`
  - `PAYMENT_REOPEN_VOIDED`
  - `PAYMENT_REFUND_REQUESTED`
  - `PAYMENT_REFUNDED`
  - `PAYMENT_REFUND_FAILED`
- Payment webhooks and repeat confirm calls are deduplicated so audit rows are only written for real state changes.

## Frontend usage

- There is no standalone `/audit-logs` route today.
- The main current consumer is `/orders/[id]`.
- The order detail page now requests both:
  - `entityType=ORDER` for the order id
  - `entityType=PAYMENT` for the related payment id when one exists
- The frontend merges both streams into a single timeline sorted by `createdAt`.

## Testing coverage

- Backend audit-log behavior is covered by controller, DTO, and service tests in `backend/src/domain/audit-log/`.
- There is no dedicated backend integration spec or standalone frontend feature spec for audit logs today; coverage is indirect through business-domain flows that emit or consume audit data.
