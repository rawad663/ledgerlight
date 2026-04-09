# Integration Tests

# 1. Backend

The backend integration suite runs real HTTP requests against the NestJS app while connected to a disposable PostgreSQL database.

## What The Backend Suite Covers

- Public backend HTTP endpoints only
- Real Nest guards, validation, filters, and interceptors
- Isolated test data seeded per test
- Automatic database setup, migration, teardown, and cleanup

Current backend coverage includes:

- Auth
- Customer
- Dashboard
- Inventory
- Location
- Orders and OrderItems
- Products
- Team and invite flows

## Prerequisites

- Docker with Docker Compose available on your `PATH`
- Backend dependencies installed

From the repo root:

```bash
cd backend
npm install
```

## How To Run Backend Integration Tests

From the `backend/` directory:

```bash
npm run test:integration
```

Backward-compatible alias:

```bash
npm run test:e2e
```

To run a single integration spec:

```bash
npm run test:integration -- --runTestsByPath ./test/integration/auth.integration-spec.ts
```

## What Happens During The Run

1. A disposable PostgreSQL container is started with Docker Compose using [`backend/test/docker-compose.integration.yml`](/Users/rawad663/Projects/ledger-light-admin/backend/test/docker-compose.integration.yml).
2. The runner generates a test-only database name and host port.
3. Test environment variables are injected:
   - `DATABASE_URL`
   - `JWT_ACCESS_SECRET`
   - `FRONTEND_URL`
   - `NODE_ENV=test`
4. Prisma migrations are applied with `prisma migrate deploy`.
5. Jest runs the backend integration suite sequentially with `--runInBand`.
6. The disposable database container is torn down in a `finally` block, even if the suite fails.

The orchestration entrypoint is [`backend/test/run-integration-tests.js`](/Users/rawad663/Projects/ledger-light-admin/backend/test/run-integration-tests.js).

## Test Isolation Rules

- Tests write only to the disposable integration database, never to the shared dev database.
- Each test seeds only the rows it needs.
- App tables are truncated between tests with `TRUNCATE ... RESTART IDENTITY CASCADE`.
- Tests should not rely on shared seed data or execution order.

## Writing New Backend Integration Tests

Place new specs under:

```bash
backend/test/integration/
```

Use the shared helpers in:

```bash
backend/test/integration/utils/
```

Key helpers:

- `create-integration-app.ts`: boots a Nest app with the same global validation/filter/interceptor behavior as production
- `test-prisma.ts`: connects to the disposable Prisma database and resets state between tests
- `factories.ts`: seeds orgs, users, memberships, locations, products, customers, orders, and related data
- `auth.ts`: logs in through real auth endpoints and builds authenticated headers for org-scoped requests
- `assertions.ts`: validates the standardized backend error response shape

When adding backend integration coverage:

- Test through public HTTP endpoints only
- Prefer real login flows over handcrafted JWTs
- Include org isolation and permission-denial coverage for org-scoped domains
- Assert audit-log side effects for write flows that are supposed to record them
- Assert the standardized error envelope:
  - `statusCode`
  - `message`
  - `path`
  - `requestId`
  - `timestamp`

## CI

Backend integration tests run in GitHub Actions through [`backend-ci.yml`](/Users/rawad663/Projects/ledger-light-admin/.github/workflows/backend-ci.yml).

The backend CI workflow now runs:

1. Prisma client generation
2. Backend lint
3. Backend unit tests
4. Backend integration tests

## Notes

- The suite is intentionally sequential to keep database lifecycle and cleanup deterministic.
- If Docker is unavailable, the backend integration suite will not be able to start its disposable database.
- If you need to debug the harness behavior, start with [`backend/test/jest-integration.json`](/Users/rawad663/Projects/ledger-light-admin/backend/test/jest-integration.json) and [`backend/test/run-integration-tests.js`](/Users/rawad663/Projects/ledger-light-admin/backend/test/run-integration-tests.js).

# 2. Frontend

The frontend integration suite runs real browser-driven page flows against the built Next.js app while pointing API traffic at a disposable local mock backend.

## What The Frontend Suite Covers

- Real page-level behavior through the App Router, including SSR data loading and client mutations
- Authentication cookie flows, logout, and refresh handling
- Real redirects, route protection, dialogs, dropdowns, forms, and table interactions
- Mocked backend responses loaded from named scenarios per test
- Playwright artifacts for failure debugging

Current frontend coverage includes:

- Auth
- Customer
- Dashboard
- Inventory
- Location
- Orders and OrderItems
- Products
- Team and invite flows

## Prerequisites

- Frontend dependencies installed
- Playwright Chromium browser installed

From the repo root:

```bash
cd frontend
npm install
npx playwright install chromium
```

## How To Run Frontend Integration Tests

From the `frontend/` directory:

```bash
npm run test:integration
```

CI-oriented variant that assumes the app is already built:

```bash
npm run test:integration:ci
```

To run one or more specific Playwright specs through the same harness:

```bash
npm run test:integration -- --skip-build test/integration/specs/auth.integration.spec.ts
```

## What Happens During The Run

1. The runner sets `NEXT_PUBLIC_API_URL` to a disposable local mock API URL.
2. Unless `--skip-build` is passed, the frontend is built with `next build`.
3. A local mock backend server starts from [`frontend/test/integration/mock-server/index.mjs`](/Users/rawad663/Projects/ledger-light-admin/frontend/test/integration/mock-server/index.mjs).
4. The built app starts with `next start`.
5. Playwright runs the browser suite sequentially with `workers: 1` using [`frontend/playwright.config.ts`](/Users/rawad663/Projects/ledger-light-admin/frontend/playwright.config.ts).
6. The runner tears down both the mock backend and the Next.js server in a `finally` block.

The orchestration entrypoint is [`frontend/test/run-integration-tests.mjs`](/Users/rawad663/Projects/ledger-light-admin/frontend/test/run-integration-tests.mjs).

## Test Isolation Rules

- Each test resets the mock backend to a named scenario before it runs.
- Tests must not depend on mutations from earlier tests.
- The suite is intentionally sequential so one scenario is active at a time.
- Auth state is established through test fixtures that set the same cookies the app reads in production.

## Writing New Frontend Integration Tests

Place new specs under:

```bash
frontend/test/integration/specs/
```

Shared harness code lives under:

```bash
frontend/test/integration/
```

Key helpers:

- [`fixtures.ts`](/Users/rawad663/Projects/ledger-light-admin/frontend/test/integration/fixtures.ts): resets scenarios, seeds auth cookies, and exposes scenario helpers
- [`helpers.ts`](/Users/rawad663/Projects/ledger-light-admin/frontend/test/integration/helpers.ts): shared UI helpers for login, Radix selects, row actions, and toast assertions
- [`mock-server/index.mjs`](/Users/rawad663/Projects/ledger-light-admin/frontend/test/integration/mock-server/index.mjs): mock API endpoints used by the frontend
- [`mock-server/scenarios.mjs`](/Users/rawad663/Projects/ledger-light-admin/frontend/test/integration/mock-server/scenarios.mjs): named seeded scenarios and tokens

When adding frontend integration coverage:

- Test real pages, not isolated components
- Prefer exercising SSR plus follow-up client mutations when the page supports both
- Reset or load the scenario in every test
- Assert redirects, URL search params, visible UI state, error messaging, and post-mutation refresh behavior
- Keep selectors aligned with accessible roles and labels so failures reflect real UX regressions

## Artifacts

Playwright outputs are written to:

- [`frontend/test-results`](/Users/rawad663/Projects/ledger-light-admin/frontend/test-results)
- [`frontend/playwright-report`](/Users/rawad663/Projects/ledger-light-admin/frontend/playwright-report)

The default artifact policy is:

- `trace: "retain-on-failure"`
- `video: "retain-on-failure"`
- `screenshot: "only-on-failure"`

One auth smoke spec records trace and video on success so there is always at least one inspectable happy-path run.

## CI

Frontend integration tests run in GitHub Actions through [`frontend-ci.yml`](/Users/rawad663/Projects/ledger-light-admin/.github/workflows/frontend-ci.yml).

The frontend CI workflow now runs:

1. Frontend lint
2. Frontend unit tests
3. Playwright browser installation
4. Frontend build
5. Frontend integration tests
6. Artifact upload for `frontend/test-results/` and `frontend/playwright-report/`

## Notes

- Chromium-only Playwright coverage is the current default.
- The mock backend is required because many frontend routes fetch server-side through `createApi()` and cannot be covered reliably with browser-only request interception.
- To debug a failing run locally, open the saved trace with `npx playwright show-trace frontend/test-results/.../trace.zip`.
