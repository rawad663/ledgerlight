# Health

## Purpose and module boundaries

The health domain exposes lightweight service checks used to confirm liveness and database connectivity. It is backend-only and intentionally small.

## Backend behavior

### Endpoints

- `GET /health`
  - performs a database connectivity check via `SELECT 1`
  - returns `{ "status": "ok" }` when successful
- `GET /health/base`
  - returns `{ "status": "ok" }` without touching the database

## Business rules and edge cases

- `/health` is the stronger readiness-style probe because it verifies Prisma can reach the database.
- `/health/base` is the faster liveness-style probe when only application process availability matters.
- Neither route is organization-scoped.

## Frontend usage

- There is no top-level frontend health page.
- This module exists to support operational checks, local validation, and infrastructure readiness probes.

## Testing coverage

- Health behavior is covered by focused controller tests in `backend/src/domain/health/health.controller.spec.ts`.
- There is no dedicated backend integration spec or frontend coverage because the module is intentionally minimal.
