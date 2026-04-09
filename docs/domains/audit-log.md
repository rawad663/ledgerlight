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

## Frontend usage

- There is no standalone `/audit-logs` route today.
- The main current consumer is `/orders/[id]`, which requests order-scoped audit data and renders it in the detail experience.

## Testing coverage

- Backend audit-log behavior is covered by controller, DTO, and service tests in `backend/src/domain/audit-log/`.
- There is no dedicated backend integration spec or standalone frontend feature spec for audit logs today; coverage is indirect through business-domain flows that emit or consume audit data.
