# Monitoring, Telemetry, and Reporting Plan

## 1. Freeze a Baseline First

Before adding tooling, define the user flows that matter most and the targets you want to hold.

For this app, start with:

- Login
- Token refresh
- List products with search and pagination
- List orders with filters and pagination
- Order details
- Inventory list
- Inventory adjustment creation
- Order creation
- Order status change

Track these core KPIs first:

- p50, p95, and p99 latency by endpoint
- Error rate
- Throughput

For higher-signal analysis, also capture:

- DB query duration and query count
- Auth refresh failures
- Memory and CPU usage over time
- Lock contention and deadlocks

Only add domain metrics that truly exist in the app today. For phase 1:

- Inventory drift count is worth considering if we define a concrete drift signal
- Invariant violations count and duplicate event count are optional follow-on metrics, not initial deliverables
- Queue backlog is deferred until a real async worker or queue exists
- Report generation duration is deferred until reporting is implemented beyond the current mock page

Use `k6` thresholds as pass/fail criteria so expectations live in versioned test scripts instead of in memory.

## 2. Define the Telemetry Architecture Up Front

Do not start by wiring libraries directly into every service. First define how telemetry should flow through this specific architecture:

`browser -> Next.js app/server routes -> NestJS backend -> PostgreSQL`

The goal is one correlated request path across all layers.

### Recommended QA stack

Use an open-source observability stack in the QA Docker Compose overlay:

- `backend`
- `postgres`
- `otel-collector`
- `prometheus`
- `grafana`
- `loki`
- `tempo`
- `postgres-exporter`

Do not add this stack to the `dev` environment. `dev` should remain the simpler local feature-work setup, while `qa` is the seeded, production-mode environment for observability work, dashboarding, and load testing.

Why this stack:

- Prometheus scrapes application and infrastructure metrics
- Grafana dashboards and explores metrics, logs, and traces
- Loki stores structured logs
- Tempo stores traces
- OpenTelemetry Collector acts as the collection and routing layer
- Postgres exporter gives database health signals that app-level spans cannot replace

If you later add background workers or queues, extend the QA stack with queue-specific exporters and dashboards.

## 3. Start From What Already Exists in the Repo

The repo already has some useful groundwork:

- Request IDs are generated in the backend middleware
- The backend already logs HTTP requests and exceptions
- Health endpoints already exist

So the first task is not to add a second observability path. The first task is to standardize and harden the existing one.

That means:

- Keep one request ID per request chain
- Propagate it through Next.js server routes and backend calls
- Emit consistent JSON logs
- Remove risky body logging by default

## 4. Instrument Both the Frontend Server Layer and the Backend

This project is not only a NestJS API. It also has Next.js server routes and server-side API calls.

That means telemetry must cover:

- Next.js route handlers such as auth login and refresh proxies
- Server-side requests from Next.js to the backend
- Incoming backend HTTP requests
- Prisma and database work
- Outbound HTTP calls if they become part of the first-phase scope

### Correlation requirements

Every request should preserve correlation context across layers:

- Request ID
- Trace ID
- Organization context
- User context when available
- Route or operation name

Do not let the Next.js layer break correlation. A request that starts in the frontend server layer should remain traceable in the backend and database spans.

## 5. Use OpenTelemetry for Traces and App Metrics

Use OpenTelemetry as the neutral instrumentation layer instead of wiring directly to a vendor.

Instrument first:

- Incoming HTTP requests
- Prisma and DB spans
- Outgoing HTTP calls only when they matter to the baseline flows
- Custom spans around high-value service methods such as order creation, inventory adjustment, order listing, and auth refresh

Add attributes that are useful for diagnosis, but be careful about cardinality:

- Good for traces and logs:
  - Request ID
  - Trace ID
  - Organization ID
  - User ID
  - Route
  - Status code
  - Search present or not
  - Pagination parameters
- Good for metrics:
  - Route template
  - HTTP method
  - Status class or bounded status code
  - Auth outcome
  - Operation type
  - Org size bucket such as `small`, `medium`, `large`

Do not use raw `organizationId`, `userId`, or raw search terms as Prometheus labels.

## 6. Make Logging Useful and Safe

Do not rely on free-form strings. Use structured JSON logs everywhere.

Every request log should include:

- Timestamp
- Level
- Message
- Request ID
- Trace ID if available
- Route
- Method
- Duration in milliseconds
- Status code
- User and org context when allowed

Every important domain event should include:

- Entity type
- Entity ID
- Actor
- Action
- Result
- Failure reason when relevant

### Redaction policy

Do not log raw request or response bodies by default.

Instead:

- Redact secrets, tokens, passwords, cookies, and payment details
- Avoid logging full DTO payloads unless there is a strong reason
- Prefer allowlisted fields over blanket body previews
- Separate HTTP access logs from domain event logs

Ship logs to Loki and use Grafana Explore for correlation with traces and metrics.

## 7. Expose Metrics Deliberately

Expose a `/metrics` endpoint for Prometheus scraping, but design the metrics carefully.

At minimum, expose:

- Request count by route, method, and status class
- Request duration histogram
- Active requests
- Error count
- Auth login failures
- Auth refresh failures
- Order creation count
- Inventory adjustment count

Add DB-focused metrics:

- DB query duration histogram
- DB query count
- Slow query count
- Connection pool usage if available

Add infrastructure and runtime metrics:

- Process memory usage over time
- Process CPU usage over time
- Event loop lag if practical
- Container CPU and memory if available through infrastructure scraping

Add database health metrics through PostgreSQL exporters and views:

- Lock contention
- Deadlocks
- Long-running transactions
- Connections used
- Query throughput

Add domain-specific counters only when the workflow exists and the signal is real:

- Invariant violations count as optional follow-on work
- Duplicate event count as optional follow-on work
- Inventory drift count
- Queue backlog after a real async worker or queue exists
- Report generation duration after reporting is implemented beyond the current mock page

For tenant comparisons, use bounded buckets, not raw tenant identifiers. Example:

- Error rate by org size bucket
- Report duration by org size bucket once reporting is real

## 8. Formalize Health and Readiness Endpoints

Treat health checks as part of monitoring design, not as an afterthought.

Split health concerns clearly:

- Liveness: the app process is up
- Readiness: the app can serve traffic and reach critical dependencies
- Metrics: separate endpoint for Prometheus scraping

Do not overload one generic endpoint with every concern.

## 9. Build Dashboards and Alerts Together

Dashboards help humans inspect. Alerts tell you when something is wrong. You need both.

### First Grafana dashboards

Build dashboards for:

- API requests per second
- p50, p95, and p99 latency by route
- 4xx and 5xx rates
- Slowest endpoints
- DB-heavy endpoint latency
- DB query duration and count
- Auth refresh failures
- CPU and memory over time
- Lock contention and deadlocks
- Orders created per minute
- Inventory adjustments per minute

Deferred follow-up dashboards once the features exist:

- Report generation duration on large tenants
- Queue backlog

### First alert rules

Add alerts for:

- Sustained 5xx rate above threshold
- p95 latency above threshold for key endpoints
- Auth refresh failure spike
- Database deadlocks above normal baseline
- Lock wait time above threshold
- Memory growth during soak tests
- CPU saturation
- Metrics scrape failure
- Trace or log pipeline failure
- Inventory drift detected

Deferred follow-up alerts once the features exist:

- Invariant violation spikes
- Queue backlog growth
- Reporting latency or failure alerts

Each alert should have a short runbook note that says:

- What it means
- Likely causes
- First places to inspect

## 10. Write `k6` Tests for Realistic Scenarios

Create a `perf/` folder:

- `perf/smoke.js`
- `perf/read-heavy.js`
- `perf/write-heavy.js`
- `perf/mixed-pos.js`

Use these test types:

- Smoke: 1 to 5 VUs to validate the script
- Baseline load: normal traffic
- Stress: ramp until degradation
- Spike: sudden burst
- Soak: 30 to 60 minutes for memory leaks, pool exhaustion, and drift

Your first mixed scenario should roughly model:

- 50% list endpoints
- 20% detail endpoints
- 10% search-heavy endpoints
- 10% inventory adjustments
- 10% order creation or status changes

Start with thresholds such as:

- p95 list endpoints under 300 ms
- Error rate under 1%
- Auth endpoints under 200 ms p95

Make the test runs reproducible:

- Seed a known dataset
- Record approximate tenant sizes
- Keep environment settings fixed
- Warm up before collecting the main sample
- Save the exact script and threshold versions used

## 11. Run Performance Tests While Recording Telemetry

This loop is where the real engineering value shows up.

When running `k6`, inspect at the same time:

- Grafana latency dashboard
- Grafana error-rate dashboard
- Grafana logs view
- Tempo trace view
- PostgreSQL activity and query stats

Then repeat:

1. Run the same test scenario
2. Identify the slowest or least stable route
3. Inspect the trace for that route
4. Correlate with logs
5. Inspect SQL shape, indexes, and lock behavior
6. Fix one bottleneck
7. Rerun the exact same test

That creates a clean before-and-after story instead of one-off tuning anecdotes.

## 12. Focus on the Bottlenecks Most Likely to Matter Here

For this app, likely early bottlenecks include:

- Offset pagination on large order and product tables
- Count queries on filtered lists
- Search over unindexed columns
- N+1 fetches on detail views
- Over-fetching large payloads
- Expensive org and location scope joins
- Response serialization overhead on large list endpoints
- Refresh or auth churn under load

For each hot endpoint:

- Capture the SQL
- Run `EXPLAIN ANALYZE`
- Add or adjust indexes
- Reduce selected columns
- Verify page-size limits
- Consider cursor pagination for the biggest tables
- Measure again

The initial baseline and optimization loop should run in `qa`, not `dev`, because QA already provides the seeded, production-mode dataset that makes observability and performance work meaningful.

## 13. Record the Outcome Like a Senior Engineer

Create `docs/perf-case-study.md` with:

- Dataset size
- Tenant size buckets used in testing
- Test scenarios
- Hardware used
- Baseline numbers
- Bottlenecks found
- Changes made
- After numbers
- Screenshots of Grafana dashboards
- One trace screenshot
- One slow-query screenshot
- Open issues and next steps

Also save:

- `k6` output
- Grafana dashboard JSON export
- Alert rule definitions
- A short demo video if you want portfolio-ready evidence

That turns “I performance-tested my app” into evidence someone else can review.

## 14. Optional: Mirror Telemetry to a Hosted APM Later

If you later want recruiter-friendly hosted APM screenshots, mirror telemetry into a service such as New Relic only after the QA-based open-source path is healthy.

Treat hosted APM as optional polish, not as the foundation of the system.

## Recommended Order for This Repo

Do this in order:

1. Harden the existing request ID and JSON logging path
2. Add end-to-end correlation across Next.js and NestJS
3. Add `otel-collector`, Prometheus, Grafana, Loki, Tempo, and Postgres exporter to the `qa` Docker Compose overlay only
4. Expose a metrics endpoint with low-cardinality app metrics
5. Add OpenTelemetry tracing for HTTP, Prisma, and the first-phase backend and Next.js server flows
6. Split liveness, readiness, and metrics endpoints cleanly
7. Build one Grafana dashboard and a small alert set in QA
8. Write one `k6` smoke test
9. Write one mixed read-heavy test
10. Run a baseline in QA and save screenshots and outputs
11. Optimize the slowest endpoint
12. Rerun in QA and write the case study
