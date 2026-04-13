# Health

## Purpose and module boundaries

The health domain exposes lightweight service checks used to confirm liveness and readiness, plus the backend metrics endpoint used by Prometheus. It is backend-only and intentionally small.

## Backend behavior

### Endpoints

- `GET /health`
  - readiness-style database connectivity check via `SELECT 1`
  - returns `{ "status": "ok" }` when successful
- `GET /health/ready`
  - explicit readiness-style database connectivity check
  - returns `{ "status": "ok" }` when successful
- `GET /health/base`
  - liveness alias that returns `{ "status": "ok" }` without touching the database
- `GET /health/live`
  - explicit liveness endpoint
  - returns `{ "status": "ok" }` without touching the database
- `GET /metrics`
  - returns Prometheus-formatted backend metrics
  - intentionally not org-scoped

## Business rules and edge cases

- `/health` and `/health/ready` are readiness-style probes because they verify Prisma can reach the database.
- `/health/base` and `/health/live` are liveness-style probes when only application process availability matters.
- `/metrics` is intended for Prometheus scraping and exposes aggregated operational metrics instead of tenant data.
- None of these routes are organization-scoped.

## Frontend usage

- There is no top-level frontend health page.
- This module exists to support operational checks, local validation, Prometheus scraping, and infrastructure readiness probes.

## Testing coverage

- Health behavior is covered by focused controller tests in `backend/src/domain/health/health.controller.spec.ts`.
- Metrics endpoint behavior is covered by `backend/src/domain/health/metrics.controller.spec.ts`.
- There is no dedicated backend integration spec or frontend coverage because the module is intentionally minimal.
