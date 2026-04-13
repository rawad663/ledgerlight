# Restore QA Log Ingestion and Trace Access

## Summary
- Fix Loki ingestion by making the QA shared log volume writable before the backend starts, so `/var/log/ledgerlight/backend.ndjson` is actually created and tailed.
- Fix the `otel-collector` Prometheus target by replacing the deprecated collector self-telemetry config with an explicit Prometheus pull reader on `otel-collector:8888`.
- Standardize trace exploration on Grafana Explore at `http://localhost:3001/explore`; keep Tempo on `http://localhost:3200` as an API/query backend, not a standalone UI.

## Key Changes
- In [docker-compose.qa.yml](/Users/rawad663/Projects/ledger-light-admin/docker-compose.qa.yml):
  - Add a QA-only one-shot init service that mounts `backend_logs`, creates `/var/log/ledgerlight`, and `chown`s it to the backend runtime user/group (`1001:65533`).
  - Make `backend` depend on that init service with `service_completed_successfully`.
  - Make `otel-collector` depend on the same init service so file tailing never starts against an unprepared volume.
  - Keep the existing `backend_logs` named volume and `LOG_FILE_PATH` path unchanged.

- In [monitoring/otel-collector-config.yaml](/Users/rawad663/Projects/ledger-light-admin/monitoring/otel-collector-config.yaml):
  - Replace `service.telemetry.metrics.address` with the current `service.telemetry.metrics.readers` pull-exporter shape bound to `0.0.0.0:8888`.
  - Leave trace OTLP ingestion on `4318` unchanged.
  - Leave the `filelog` receiver pointed at `/var/log/ledgerlight/*.ndjson`.

- In [docs/MONITORING.md](/Users/rawad663/Projects/ledger-light-admin/docs/MONITORING.md):
  - Clarify that Tempo does not provide a browser UI on `:3200`; the supported trace UI is Grafana Explore.
  - Update verification steps to use Grafana Explore with the Tempo datasource, not `http://localhost:3200/explore`.
  - Document the expected healthy state:
    - `backend`, `postgres-exporter`, and `otel-collector` are `UP` in Prometheus
    - backend stdout and `backend.ndjson` contain the same structured events
    - Loki queries return the smoke-test request IDs
    - Tempo traces are searchable through Grafana Explore

- Update the existing QA smoke-verification plan doc so its trace and log checks match the supported access paths and include the collector target check.

## Public Interfaces / Operational Changes
- Supported trace UI:
  - `http://localhost:3001/explore` with datasource `Tempo`
- Tempo host port:
  - `http://localhost:3200` remains API-only for health/search/trace fetches
- Prometheus scrape contract:
  - `otel-collector:8888` must expose collector self-metrics and be `UP`
- QA runtime contract:
  - `/var/log/ledgerlight/backend.ndjson` must exist after backend traffic and be readable by the collector

## Test Plan
- Config validation:
  - Render QA compose config and confirm the new init service plus dependency chain are present.
  - Restart the QA monitoring stack from a clean state so the volume-permission fix is exercised on boot.

- Log-path verification:
  - Generate the existing smoke traffic.
  - Confirm `/var/log/ledgerlight/backend.ndjson` exists inside the backend container and contains the smoke request IDs.
  - Confirm the collector no longer logs `no files match the configured criteria`.

- Prometheus verification:
  - Confirm `http://localhost:9090/targets` shows `backend`, `postgres-exporter`, and `otel-collector` as `UP`.
  - Confirm collector self-metrics are scrapeable from the `otel-collector` job.

- Loki and Tempo verification:
  - In Grafana Explore, query Loki for `monitoring-login-fail-1`, `monitoring-products-1`, and `monitoring-fe-products-1`.
  - From one returned Loki line, pivot via `trace_id` into the Tempo datasource and confirm the trace includes `app.request_id`, `http.route`, and `app.organization_id`.
  - Verify direct Tempo API search still works on `:3200`, but no UI is expected there.

## Assumptions
- The goal is to make the current QA stack work as designed, not to add a separate trace UI outside Grafana.
- The fix stays QA-only; no dev-stack observability expansion is included.
- The preferred implementation is a QA init service for volume ownership, not changing the backend to run as root.
