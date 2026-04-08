# Backend Integration Test Harness, Coverage, and CI

## Summary
- Build a dedicated backend integration test suite that runs real HTTP requests against a Nest app connected to a disposable Postgres database.
- Use an ephemeral test database that is started for the test run, migrated before tests, truncated between tests, and torn down after the run. Tests may write only to this disposable DB.
- Scope the suite to public HTTP endpoints only. For domains that are not truly CRUD over HTTP today, cover the actual public flows instead of inventing new API coverage.
- Run the new integration suite in `.github/workflows/backend-ci.yml` so regressions are caught on PRs and pushes.

## Key Changes
- Add a canonical `npm run test:integration` command, with `test:e2e` kept as a backward-compatible alias.
- Add a dedicated integration Jest config that fixes the current alias problem in `backend/test/jest-e2e.json` by including `@src/*`, Prisma generated module mappings, and shared test setup.
- Add a test runner that:
  - Starts a disposable Postgres container via Docker Compose.
  - Sets test-only `DATABASE_URL`, `JWT_ACCESS_SECRET`, and `FRONTEND_URL`.
  - Runs `prisma migrate deploy` against the disposable DB.
  - Runs the integration Jest suite in `--runInBand`.
  - Always tears the DB container down in a `finally` path.
- Add an integration app factory that mirrors `backend/src/main.ts` behavior:
  - `ValidationPipe` with `whitelist`, `forbidNonWhitelisted`, `transform`
  - `AllExceptionsFilter`
  - `LoggingInterceptor`
  - `helmet`, `compression`, and shutdown hooks
- Add DB helpers for integration tests:
  - Table truncation between tests using `TRUNCATE ... RESTART IDENTITY CASCADE` for app tables except `_prisma_migrations`
  - Minimal fixture/factory helpers for orgs, users, memberships, locations, products, customers, orders, invite tokens, and auth login setup
  - Auth helper that seeds a user and logs in via `POST /auth/login` to obtain real JWTs for role-scoped requests
- Replace the placeholder smoke e2e setup with domain-focused suites grouped by API behavior, not Prisma mocks.
- Update `.github/workflows/backend-ci.yml`:
  - Extend the `paths-filter` so backend CI also runs when `.github/workflows/backend-ci.yml`, backend test harness files, or shared Docker/test DB orchestration files change
  - Keep existing lint and unit test steps
  - Add a new integration-test step after unit tests that runs `npm run test:integration`
  - Ensure required env vars are provided in CI and rely on GitHub-hosted runner Docker availability for the disposable DB lifecycle

## Coverage Plan
- Auth:
  - `POST /auth/login` success returns access token, refresh token, active memberships, updates `lastLoginAt`, and writes login audit logs.
  - `POST /auth/login` rejects invalid password and inactive/no-active-membership users with production error shape.
  - `POST /auth/refresh` succeeds with a valid refresh token and fails after logout or with an invalid token.
  - `POST /auth/logout` returns `204`, revokes active refresh tokens, and blocks subsequent refresh.
- Customer:
  - Create, list, get, update, delete through HTTP.
  - Search/filter behavior on list.
  - Org isolation and permission denial coverage.
- Dashboard:
  - `GET /dashboard/summary` returns correct today sales, order count, active customers, and low-stock count.
  - `GET /dashboard/sales-overview` returns correct bucket totals for day/week/month inputs.
  - Location-scoped membership only sees permitted locations’ data.
- Inventory:
  - `GET /inventory` returns aggregated product quantities and low-stock flags.
  - `GET /inventory/levels` supports location/search/lowStock filtering and respects location scope.
  - `POST /inventory/adjustments` updates inventory level and creates adjustment rows.
  - Negative adjustment below zero fails with the real error envelope.
  - Inventory “CRUD” is represented by read + adjustment flows because no create/update/delete inventory-level endpoints exist today.
- Location:
  - Create, list, get, update, delete through HTTP.
  - Restricted user cannot create locations and cannot access out-of-scope locations.
  - Delete conflicts for only-location, on-hand inventory, and order-history cases.
- Orders + OrderItems:
  - Create order computes totals and creates nested items.
  - List/detail/update/delete order flows.
  - Status transitions enforce allowed transitions.
  - Add item and delete item flows update the order correctly.
  - Location-scoped membership cannot operate on out-of-scope orders.
- Products:
  - Create product succeeds and, when initial inventory is provided, also creates inventory level and initial adjustment in the same flow.
  - List, get, update, archive through HTTP.
  - Duplicate SKU returns conflict via Prisma/global filter path.
  - Scoped member cannot initialize inventory at an inaccessible location.
- Team:
  - List members, get roles, get member detail.
  - Invite member creates user or membership as needed, creates invite token, and writes audit logs.
  - Resolve invite returns valid, expired, and invalid states correctly.
  - Accept invite for new-user and existing-user flows.
  - Update profile, update role, update locations, deactivate, reactivate, and resend invite all behave correctly and write audit logs.
  - Team “CRUD” is represented by actual public team lifecycle endpoints because no delete member endpoint exists today.

## Test Design and Verification
- Each test seeds only the rows it needs into the disposable DB and never relies on shared seed state.
- Each test exercises the real Nest guard chain: JWT auth, organization context, permission enforcement, validation, and exception filter.
- Write-flow tests should assert audit-log side effects where required by the service contract.
- Cross-tenant and permission assertions are required in every org-scoped domain.
- Error-case assertions should verify the standardized response envelope: `statusCode`, `message`, `path`, `requestId`, `timestamp`.
- Final validation target:
  - local `npm run test:integration`
  - CI backend workflow runs lint, unit tests, and integration tests
  - backend build remains green

## Public Interface Changes
- Add `npm run test:integration`.
- Keep `npm run test:e2e` as an alias.
- Add dedicated integration Jest config and Docker-based test DB orchestration artifacts.
- Update `backend-ci` workflow to invoke the integration suite.
- No production API, schema, or migration changes are required.

## Assumptions and Defaults
- “Not writing to the database” means “do not write to the shared/dev database”; writing to a disposable test DB is required and accepted.
- HTTP endpoints only are in scope.
- Isolation uses full table truncation between tests, not per-suite reset or transactional rollback.
- Integration tests run sequentially with `--runInBand` for deterministic DB isolation.
- Docker Compose remains the orchestration mechanism locally and in GitHub Actions because the repo is already Docker-oriented and GitHub-hosted Ubuntu runners provide Docker.
