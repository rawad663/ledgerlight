# QA Monitoring Smoke Verification

## Summary
- Generate a small, repeatable burst of QA traffic that creates metrics, logs, and traces without mutating demo business data.
- Verify two paths: direct backend traffic first, then frontend-triggered traffic through Next.js to prove correlation headers survive the server layer.
- Use the existing QA stack only: backend `:8081`, frontend `:3000`, Prometheus `:9090`, Grafana `:3001`, Loki `:3100`, Tempo `:3200`.

## Interfaces Used
- Backend: `GET /health/live`, `GET /health/ready`, `GET /metrics`, `POST /auth/login`, `POST /auth/refresh`, `GET /products`, `GET /orders`, `GET /inventory/levels`
- Frontend: `POST /api/auth/login`, `GET /products?search=a`, `GET /orders?search=a&status=PENDING`, `GET /inventory?search=a`
- Monitoring surfaces: Prometheus targets and queries, Grafana dashboard `Ledger Light QA Observability`, Grafana Explore with the `Loki` and `Tempo` datasources, and Tempo's direct API on `:3200`

## Request Sequence
1. Start prerequisites if they are not already running:
```bash
make qa-build
make qa-migrate
make qa-seed
cd frontend && npm run qa
```

2. Pick one seeded QA user:
```bash
QA_EMAIL=$(docker compose --env-file .env.qa -f docker-compose.yml -f docker-compose.qa.yml -p ledgerlight-qa exec -T db psql -U postgres -d ledgerlight_demo -At -c 'select email from "User" order by email limit 1;')
echo "$QA_EMAIL"
```

3. Generate direct backend traffic:
```bash
curl -s http://localhost:8081/health/live >/dev/null
curl -s http://localhost:8081/health/ready >/dev/null
curl -s -X POST http://localhost:8081/auth/login -H 'Content-Type: application/json' -H 'X-Request-Id: monitoring-login-fail-1' --data "{\"email\":\"$QA_EMAIL\",\"password\":\"WrongPass123!\"}" >/dev/null
curl -s -X POST http://localhost:8081/auth/refresh -H 'Content-Type: application/json' -H 'X-Request-Id: monitoring-refresh-fail-1' --data '{"userId":"00000000-0000-0000-0000-000000000000","refreshTokenRaw":"invalid"}' >/dev/null
LOGIN_JSON=$(curl -s -X POST http://localhost:8081/auth/login -H 'Content-Type: application/json' -H 'X-Request-Id: monitoring-login-ok-1' --data "{\"email\":\"$QA_EMAIL\",\"password\":\"DemoPass123!\"}")
ACCESS_TOKEN=$(echo "$LOGIN_JSON" | jq -r '.accessToken')
ORG_ID=$(echo "$LOGIN_JSON" | jq -r '.memberships[0].organizationId')
curl -s "http://localhost:8081/products?search=a&limit=5" -H "Authorization: Bearer $ACCESS_TOKEN" -H "X-Organization-Id: $ORG_ID" -H 'X-Request-Id: monitoring-products-1' >/dev/null
curl -s "http://localhost:8081/orders?search=a&status=PENDING&limit=5" -H "Authorization: Bearer $ACCESS_TOKEN" -H "X-Organization-Id: $ORG_ID" -H 'X-Request-Id: monitoring-orders-1' >/dev/null
curl -s "http://localhost:8081/inventory/levels?search=a&limit=5" -H "Authorization: Bearer $ACCESS_TOKEN" -H "X-Organization-Id: $ORG_ID" -H 'X-Request-Id: monitoring-inventory-1' >/dev/null
```

4. Generate frontend-through-Next.js traffic:
```bash
curl -s -c /tmp/ledgerlight-monitoring.cookies -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' -H 'X-Request-Id: monitoring-fe-login-1' --data "{\"email\":\"$QA_EMAIL\",\"password\":\"DemoPass123!\"}" >/dev/null
curl -s -b /tmp/ledgerlight-monitoring.cookies -H 'X-Request-Id: monitoring-fe-products-1' "http://localhost:3000/products?search=a" >/dev/null
curl -s -b /tmp/ledgerlight-monitoring.cookies -H 'X-Request-Id: monitoring-fe-orders-1' "http://localhost:3000/orders?search=a&status=PENDING" >/dev/null
curl -s -b /tmp/ledgerlight-monitoring.cookies -H 'X-Request-Id: monitoring-fe-inventory-1' "http://localhost:3000/inventory?search=a" >/dev/null
```

5. Wait 20-30 seconds, then spot-check raw metrics:
```bash
curl -s http://localhost:8081/metrics | rg 'ledgerlight_(http_requests_total|http_errors_total|auth_failures_total|db_queries_total|http_request_duration_seconds|db_query_duration_seconds)'
```

## Verification Steps
- `Prometheus`: open `http://localhost:9090/targets` and confirm `backend`, `postgres-exporter`, and `otel-collector` are `UP`.
- `Prometheus`: if `otel-collector` is `DOWN`, treat that as a collector self-metrics failure even if traces still reach Tempo.
- `Prometheus`: run `sum(rate(ledgerlight_http_requests_total[5m])) by (route)`.
- `Prometheus`: run `sum(rate(ledgerlight_http_errors_total[5m])) by (route, status_class)`.
- `Prometheus`: run `sum(rate(ledgerlight_auth_failures_total{operation="refresh"}[5m]))`.
- `Prometheus`: run `sum(rate(ledgerlight_db_queries_total[5m])) by (operation)`.
- `Grafana`: open `http://localhost:3001`, sign in with `admin` / `admin`, and open `Ledger Light QA Observability`.
- `Grafana`: confirm these panels move after the requests: `HTTP Request Rate by Route`, `P95 Latency by Route`, `HTTP Error Rate by Route`, `Auth Refresh Failures`, `P95 DB Query Duration`.
- `Grafana Explore`: select the `Loki` datasource and query `{service_name="ledger-light-backend"} | json | attributes_request_id="monitoring-login-fail-1"` to confirm a `request_failed` log with `attributes_status_code="401"`.
- `Grafana Explore`: query `{service_name="ledger-light-backend"} | json | attributes_request_id="monitoring-products-1"` and confirm a `request_completed` log with `attributes_route="/products"`.
- `Grafana Explore`: query `{service_name="ledger-light-backend"} | json | attributes_request_id="monitoring-fe-products-1"` and confirm the frontend-triggered request still shows up as backend telemetry with the same request ID.
- `Grafana Explore`: switch to the `Tempo` datasource, paste a `trace_id` from one Loki log entry, and confirm the trace contains backend spans for the matching route plus attributes such as `app.request_id`, `http.route`, and `app.organization_id`.
- `Tempo API`: optionally verify `http://localhost:3200/api/search?limit=5` works, but no browser UI is expected on `http://localhost:3200/`.

## Acceptance Criteria
- Failed login and failed refresh produce error metrics plus structured `request_failed` logs.
- Successful authenticated list requests produce HTTP metrics, DB query metrics, structured `request_completed` logs, and Tempo traces.
- Frontend-triggered page requests still appear in backend logs and traces with the same request IDs, proving the Next.js layer preserved correlation.
- The default Grafana dashboard reflects the generated traffic within one scrape interval.
- The backend also writes the same structured events to `/var/log/ledgerlight/backend.ndjson`, and the collector exposes self-metrics as an `UP` Prometheus target.

## Assumptions and Defaults
- This repo is still in Plan Mode, so the requests above are specified but not executed in this turn.
- `frontend` runs on `http://localhost:3000` via `npm run qa`, and `.env.qa` points `NEXT_PUBLIC_API_URL` to `http://localhost:8081`.
- `jq` and `rg` are available locally; if `jq` is missing, use `http://localhost:8081/docs` to perform login once and copy `accessToken` plus `memberships[0].organizationId`.
- The plan intentionally skips write endpoints like order creation and inventory adjustments so the QA dataset stays stable during smoke verification.
- Grafana Explore, not Tempo's host port, is the supported human-facing trace UI.
