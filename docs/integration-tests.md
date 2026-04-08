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
