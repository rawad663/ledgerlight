# Monitoring Plan V1 Execution Log

## Note on format

This log records the concrete steps, checks, and high-level decisions used to implement the monitoring plan. It does not include private chain-of-thought; it is an execution journal.

## Step-by-step execution log

1. Read the monitoring plan in `plans/MONITORING Plan V1.md` and matched it against the repo structure.
2. Inspected the existing Docker Compose files and confirmed that `qa` already has the production-mode backend and seeded QA database shape needed for observability work.
3. Inspected backend entrypoints and confirmed the repo already had:
   - request IDs in the request-context middleware
   - a global logging interceptor
   - a global exception filter
   - health endpoints
4. Inspected frontend server-layer code and confirmed that auth route handlers, middleware refresh calls, and server-side API creation did not consistently forward request correlation headers.
5. Installed backend dependencies needed for Prometheus metrics and OpenTelemetry tracing:
   - `prom-client`
   - `@opentelemetry/api`
   - `@opentelemetry/sdk-node`
   - `@opentelemetry/auto-instrumentations-node`
   - `@opentelemetry/exporter-trace-otlp-http`
   - `@opentelemetry/resources`
   - `@prisma/instrumentation`
6. Added backend monitoring primitives under `backend/src/common/monitoring/`:
   - route/status helper utilities
   - a Prometheus monitoring service
   - a metrics interceptor
   - structured JSON log writing that also supports a shared QA log file
7. Hardened backend request correlation and logging:
   - fixed request ID reuse to read the incoming header correctly
   - removed request/response body preview logging
   - enriched logs with request ID, trace ID, route, org, user, and duration
8. Added backend OpenTelemetry bootstrap so the backend exports traces to the QA collector when OTLP env vars are present.
9. Added backend metrics and probes:
   - `/metrics`
   - `/health/live`
   - `/health/ready`
   - kept `/health` and `/health/base` as compatibility aliases
10. Added DB query count and duration metrics by wrapping the underlying `pg` pool used by the Prisma adapter.
11. Added focused backend tests for:
   - request-context middleware
   - monitoring service metrics
   - structured request logging
   - health controller
   - metrics controller
12. Added frontend server-layer correlation utilities in `frontend/lib/server-observability.ts`.
13. Updated frontend server-side API calls to forward `X-Request-Id`, `traceparent`, and `tracestate`:
   - `frontend/lib/api.ts`
   - `frontend/app/api/auth/login/route.ts`
   - `frontend/app/api/auth/refresh/route.ts`
   - `frontend/middlewares/auth.ts`
14. Added frontend tests for the new correlation helper and updated auth middleware tests to assert the forwarded request ID header.
15. Added the QA-only observability stack and configuration files:
   - OpenTelemetry Collector
   - Prometheus
   - Loki
   - Tempo
   - Grafana provisioning and baseline dashboard
   - PostgreSQL exporter
16. Added a shared backend log volume so structured backend logs can be shipped into Loki through the collector.
17. Validated the QA Compose stack with `docker compose ... config`.
18. Wrote monitoring documentation in `docs/MONITORING.md`.
19. Updated module and environment docs that changed because of the implementation:
   - `docs/domains/health.md`
   - `docs/domains/auth.md`
   - `docs/ENVIRONMENTS.md`

## Validation performed

- Backend targeted Jest suite:
  - request-context middleware
  - monitoring service
  - logging interceptor
  - health controller
  - metrics controller
- Frontend targeted Vitest suite:
  - `lib/server-observability.test.ts`
  - `middlewares/auth.test.ts`
- Backend build:
  - `cd backend && npm run build`
- Frontend build:
  - `cd frontend && LEDGERLIGHT_ENV=qa npm run build`
- Docker Compose QA config render:
  - `docker compose --env-file .env.qa -f docker-compose.yml -f docker-compose.qa.yml config`

## Important implementation notes

- The monitoring stack was added to `qa` only, not `dev`.
- Stripe-specific telemetry was intentionally left out of phase 1.
- Queue and reporting metrics remain deferred because those features are not real backend workflows yet.
- The backend remains the main telemetry source in phase 1; the Next.js server layer currently focuses on correlation propagation rather than a full separate telemetry SDK.
