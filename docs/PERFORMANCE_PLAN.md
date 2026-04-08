## 1. Baseline Metrics
### Critial flows to measure
* login / refresh
* list products with search + pagination
* list orders with filters + pagination
* order details
* inventory list
* inventory adjustment creation
* order creation / status change

### Core KPIs:
* p50 / p95 latency
* error rate
* throughput

## 2. Observability stack using open-source tools
Use this stack locally in Docker Compose:

* Prometheus for metrics scraping
* Grafana for dashboards
* Loki for logs
* Tempo for traces

Compose setup should end up looking roughly like:

* backend
* postgres
* prometheus
* grafana
* loki
* tempo

## 3. Instrument the NestJS app with OpenTelemetry

Use **OpenTelemetry** as your instrumentation layer instead of wiring directly to one vendor. The Node.js OTel docs explicitly cover getting started with traces and metrics, and OTel is the right neutral foundation for a project like this. One note from the official Node.js docs: logs support in OTel Node is still under development, so for logs I’d keep using structured JSON logging from your app and ship those separately to Loki.

What to instrument first:

* incoming HTTP requests
* Prisma / DB spans
* outgoing calls if any
* custom spans for service methods like `createOrder`, `adjustInventory`, `listOrders`

Also attach these attributes to spans and logs:
* request ID
* organization ID
* user ID
* route
* status code
* DB query duration
* pagination params
* search term present or not

## 4. Expose metrics from the app

Prometheus works by scraping metric endpoints over HTTP.

At minimum, expose:

* request count by route + method + status
* request duration histogram
* DB query duration histogram
* active requests
* error count
* auth failures
* inventory adjustments count
* order creations count

For a POS, the most useful first Grafana panels are:

* API requests per second
* p50 / p95 / p99 latency by route
* 4xx vs 5xx rate
* slowest endpoints
* DB-heavy endpoint latency
* top searched routes
* orders created per minute
* inventory adjustments per minute

## 5. Make your logs actually useful

Don’t log strings. Log JSON.

Every request log should include:

* timestamp
* level
* message
* request ID
* route
* method
* user / org context
* duration_ms
* status_code

Every important domain event should include:
* entity type
* entity ID
* actor
* action
* result
* failure reason if any

Ship those logs into Loki and use Grafana Explore to query them.

## 6. Write k6 tests for realistic scenarios

Use k6 OSS for load generation. The official docs position it as the open-source load-testing tool, and its scenarios/thresholds model is exactly what you need here.

## 6. Write k6 tests for realistic scenarios

Use k6 OSS for load generation. The official docs position it as the open-source load-testing tool, and its scenarios/thresholds model is exactly what you need here.

Create a `/perf` folder like this:

* `perf/smoke.js`
* `perf/read-heavy.js`
* `perf/write-heavy.js`
* `perf/mixed-pos.js`

### Test types:

* **smoke:** 1–5 VUs just to validate the script
* **baseline load:** normal user traffic
* **stress:** ramp until degradation
* **spike:** sudden burst
* **soak:** 30–60 min steady traffic for memory leaks / connection pool issues

Your first realistic mixed scenario should look like:

* 50% list endpoints
* 20% detail endpoints
* 10% search-heavy endpoints
* 10% inventory adjustments
* 10% order creation / status changes

And add thresholds like:

* p95 list endpoints < 300ms
* error rate < 1%
* auth endpoints < 200ms p95

## 7. Run tests while recording dashboards and traces
When you run k6, have these open at the same time:

* Grafana latency dashboard
* Grafana error-rate dashboard
* Grafana logs view
* Tempo trace view
* Postgres activity view / query stats

Then do this loop:

1. run the test
1. identify slow routes
1. inspect traces for those routes
1. inspect logs for correlation
1. inspect SQL shape and indexes
1. fix one bottleneck
1. rerun the exact same test

## 8. Focus on the bottlenecks most likely to show up in your app

Given your schema size, I’d expect the first pain points to be:

* offset pagination on large order/product tables
* count queries on filtered lists
* search over unindexed columns
* N+1 fetches on order detail / inventory pages
* over-fetching large payloads
* expensive joins around org/location membership
* response serialization overhead on big list endpoints

So for each hot endpoint:

* capture the SQL
* run EXPLAIN ANALYZE
* add or adjust indexes
* reduce selected columns
* verify page size limits
* consider cursor pagination for the biggest tables
* measure again

9. Record the outcome

Create a /docs/perf-case-study.md with:
* dataset size
* test scenarios
* hardware used
* baseline numbers
* bottlenecks found
* changes made
* after numbers
* screenshots of Grafana dashboards
* one trace screenshot
* one slow-query screenshot
* next steps

Also save:

* k6 output
* Grafana dashboard JSON export
* short Loom demo