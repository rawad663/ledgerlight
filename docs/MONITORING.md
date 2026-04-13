# Monitoring

## Purpose

This repo now ships a QA-only observability stack for backend metrics, traces, and logs. The goal is to make performance work, debugging, and load testing reproducible in the seeded QA environment without adding monitoring overhead to the simpler dev stack.

Phase 1 covers:

- Backend HTTP metrics
- Backend database query metrics
- Backend structured JSON logs
- Backend OpenTelemetry traces
- PostgreSQL exporter metrics
- Request and trace correlation through the Next.js server layer into the NestJS backend

Phase 1 intentionally does not cover:

- Stripe-specific telemetry
- Queue metrics, because there is no real queue or worker service yet
- Reporting duration metrics, because `/reports` is still mock-only

## Architecture

Telemetry flows through this path:

`browser -> Next.js server routes / server components -> NestJS backend -> PostgreSQL`

### Correlation model

- The frontend server layer forwards `X-Request-Id`, `traceparent`, and `tracestate` whenever it calls the backend.
- The backend request context middleware guarantees every request has an `X-Request-Id`.
- The backend logging interceptor and exception filter write structured JSON logs with request, route, org, user, timing, and trace identifiers.
- The backend OpenTelemetry SDK exports traces to the local OpenTelemetry Collector.
- Prometheus scrapes the backend `/metrics` endpoint and the PostgreSQL exporter.
- The backend also writes structured log lines to a shared QA volume, and the OpenTelemetry Collector tails that file and forwards logs to Loki.
- Grafana Explore is the supported UI for both Loki logs and Tempo traces.

### Why QA only

The observability stack lives only in `qa` because QA already has:

- production-mode backend behavior
- realistic seeded demo data
- stable ports separate from dev
- a workload shape that makes dashboards and performance numbers meaningful

The `dev` environment stays lean for normal feature work and watch mode.

## Tools and Roles

### Application-side tooling

- `prom-client`
  - exposes Prometheus-formatted application metrics from the NestJS backend
  - records HTTP request totals, latency, active requests, DB query metrics, auth refresh failures, order creation counts, and inventory adjustment counts
- OpenTelemetry Node SDK
  - creates backend trace spans for incoming HTTP work, Prisma calls, and outbound HTTP calls that fall inside the current trace
  - exports traces over OTLP HTTP
- Prisma instrumentation plus pooled query timing
  - contributes Prisma spans to traces
  - records DB query count and duration metrics on the app side

### QA observability stack

- OpenTelemetry Collector
  - the central collection layer for QA
  - receives OTLP traces from the backend
  - tails backend JSON log files from the shared volume
  - forwards traces to Tempo and logs to Loki
- Prometheus
  - scrapes backend `/metrics`
  - scrapes PostgreSQL exporter metrics
  - loads basic alerting rules for local QA monitoring
- Grafana
  - visualizes Prometheus metrics, Loki logs, and Tempo traces
  - ships with provisioned datasources and a baseline QA dashboard
- Loki
  - stores backend structured logs for query and correlation
- Tempo
  - stores distributed traces from the backend
- PostgreSQL exporter
  - exposes DB-level metrics such as deadlocks and connection statistics

## Implemented Endpoints and Signals

### Backend endpoints

- `GET /health`
  - readiness-style database check
- `GET /health/ready`
  - explicit readiness endpoint
- `GET /health/base`
  - existing liveness alias
- `GET /health/live`
  - explicit liveness endpoint
- `GET /metrics`
  - Prometheus metrics endpoint

### Key backend metrics

- `ledgerlight_http_requests_total`
- `ledgerlight_http_request_duration_seconds`
- `ledgerlight_http_requests_active`
- `ledgerlight_http_errors_total`
- `ledgerlight_auth_failures_total`
- `ledgerlight_order_creations_total`
- `ledgerlight_inventory_adjustments_total`
- `ledgerlight_db_queries_total`
- `ledgerlight_db_query_duration_seconds`
- `ledgerlight_slow_queries_total`
- default Node/process metrics with the `ledgerlight_` prefix

### PostgreSQL metrics

PostgreSQL exporter provides the DB-level signals that the application cannot derive reliably on its own, including:

- deadlocks
- connections
- database-level throughput and transaction counters

## Logging Design

Backend request and exception logs are now structured JSON lines with fields such as:

- timestamp
- level
- context
- message
- request id
- resource id
- trace id
- span id
- route
- method
- status code
- duration
- user id when present
- organization id when present

The backend no longer logs request and response body previews by default. This keeps auth and payment-related data out of routine access logs.

In QA, the backend writes these JSON logs both to stdout and to a shared log file mounted at `/var/log/ledgerlight/backend.ndjson`. The collector reads that file and forwards it to Loki.
The QA stack prepares that shared volume before the backend starts so the non-root NestJS process can create the log file reliably.

## QA Stack Files

The QA monitoring stack is defined by:

- [docker-compose.qa.yml](/Users/rawad663/Projects/ledger-light-admin/docker-compose.qa.yml)
- [monitoring/otel-collector-config.yaml](/Users/rawad663/Projects/ledger-light-admin/monitoring/otel-collector-config.yaml)
- [monitoring/prometheus.yml](/Users/rawad663/Projects/ledger-light-admin/monitoring/prometheus.yml)
- [monitoring/prometheus-alerts.yml](/Users/rawad663/Projects/ledger-light-admin/monitoring/prometheus-alerts.yml)
- [monitoring/loki-config.yaml](/Users/rawad663/Projects/ledger-light-admin/monitoring/loki-config.yaml)
- [monitoring/tempo.yaml](/Users/rawad663/Projects/ledger-light-admin/monitoring/tempo.yaml)
- [monitoring/grafana/provisioning/datasources/datasources.yaml](/Users/rawad663/Projects/ledger-light-admin/monitoring/grafana/provisioning/datasources/datasources.yaml)
- [monitoring/grafana/provisioning/dashboards/dashboards.yaml](/Users/rawad663/Projects/ledger-light-admin/monitoring/grafana/provisioning/dashboards/dashboards.yaml)
- [monitoring/grafana/dashboards/ledgerlight-qa-observability.json](/Users/rawad663/Projects/ledger-light-admin/monitoring/grafana/dashboards/ledgerlight-qa-observability.json)

## Running the Stack

### Start QA backend and database

```bash
make qa-build
make qa-migrate
make qa-seed
```

### Run the frontend against QA

```bash
cd frontend
LEDGERLIGHT_ENV=qa npm run dev
```

### Run the repeatable smoke test

```bash
node ./scripts/run-qa-monitoring-smoke-test.mjs
```

Optional flags:

- `--skip-frontend`
  - only exercise the backend path when the Next.js app is not running
- `--wait-ms=30000`
  - increase or reduce the scrape/log-shipping wait before verification

### Access the tools

- Backend API: `http://localhost:8081`
- Backend Swagger: `http://localhost:8081/docs`
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3001`
  - default local credentials: `admin` / `admin`
- Loki: `http://localhost:3100`
- Tempo: `http://localhost:3200`
  - API/query backend only, not a standalone browser UI
- PostgreSQL exporter: `http://localhost:9187/metrics`

Use Grafana Explore at `http://localhost:3001/explore` for trace and log investigation. Select the `Tempo` datasource for traces and `Loki` for logs.
For backend request correlation logs in Loki, query the parsed collector attributes such as `attributes_request_id`, `attributes_trace_id`, and `attributes_route`.

## Default Dashboard and Alerts

Grafana is provisioned with a baseline dashboard named `Ledger Light QA Observability`. It focuses on:

- request rate by route
- p95 latency by route
- HTTP error rate
- auth refresh failures
- DB query latency
- process CPU and memory
- PostgreSQL deadlocks

Prometheus is provisioned with local QA alerts for:

- elevated 5xx rate
- elevated p95 latency
- auth refresh failure spikes
- monitoring target downtime
- PostgreSQL deadlocks

These are local QA signals, not production paging rules.

## Healthy Verification State

When the QA observability stack is healthy:

- Prometheus targets `backend`, `postgres-exporter`, and `otel-collector` are all `UP`
- backend structured events appear both on container stdout and in `/var/log/ledgerlight/backend.ndjson`
- Loki queries return backend request IDs such as smoke-test correlation IDs
- Tempo traces are searchable through Grafana Explore with the `Tempo` datasource

## Deferred Work

These items are intentionally deferred until the product grows into them:

- queue backlog and worker metrics
- report generation duration metrics
- report latency dashboards and alerts
- Stripe-specific payment traces and dashboards
- org-size bucketed metrics, once the product defines stable tenant-size buckets
