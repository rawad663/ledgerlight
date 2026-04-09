# Frontend Integration Test Harness, Coverage, CI, and Docs

## Summary
Add a Playwright-based frontend integration suite that validates real page behavior against a local mocked backend server, covering the same critical flows as backend integration tests: Auth, Customer, Dashboard, Inventory, Location, Orders and OrderItems, Products, and Team/invite flows.

Update [`docs/integration-tests.md`](/Users/rawad663/Projects/ledger-light-admin/docs/integration-tests.md) to include a new `# Frontend` section that mirrors the structure and depth of the existing backend section: what the suite covers, prerequisites, how to run it, what happens during the run, test isolation rules, how to add new tests, CI behavior, artifact locations, and debugging notes.

## Key Changes
- Add Playwright to `frontend/` with canonical scripts:
  - `npm run test:integration`
  - `npm run test:integration:ci`
- Add a mock backend server under `frontend/test/integration/` that serves the frontend-used endpoints plus a small scenario-control API.
- Run the built Next app against that mock server by setting `NEXT_PUBLIC_API_URL` to the mock server port.
- Add Playwright fixtures/helpers for:
  - scenario reset per test
  - seeded auth cookies and memberships
  - reusable navigation helpers for private routes and invite flows
- Keep the suite sequential with `workers: 1` for deterministic mock-state isolation.
- Add Playwright artifact configuration:
  - global default: `trace: "retain-on-failure"`, `video: "retain-on-failure"`, `screenshot: "only-on-failure"`
  - one auth smoke spec uses always-on trace/video so at least one successful flow is inspectable
  - save outputs to `frontend/test-results/` and `frontend/playwright-report/`
- Update [`frontend-ci.yml`](/Users/rawad663/Projects/ledger-light-admin/.github/workflows/frontend-ci.yml) to run:
  - `npm ci`
  - `npm run lint`
  - `npm run test:run`
  - `npm run build`
  - `npx playwright install --with-deps chromium`
  - `npm run test:integration:ci`
  - artifact upload for `frontend/test-results/` and `frontend/playwright-report/`
- Update [`docs/integration-tests.md`](/Users/rawad663/Projects/ledger-light-admin/docs/integration-tests.md) with a dedicated `# Frontend` section similar to `# 1. Backend`, not just a short note.

## Coverage Plan
- Auth:
  - login success and failure
  - logout from the app shell
  - refresh via private-route access with expired access token
  - redirect to `/login?returnTo=...` when refresh fails
- Customer:
  - list/search/filter
  - create, edit, delete
- Dashboard:
  - SSR render of summary, sales overview, recent orders, and low-stock watchlist
  - redirect from `/` to `/products` for roles without dashboard access
- Inventory:
  - list/search/location filter/low-stock toggle
  - stock adjustment success and failure
- Location:
  - list/filter/count cards
  - create, edit, archive/delete conflict handling
- Orders and OrderItems:
  - orders list/filtering
  - create order
  - order detail SSR load
  - edit, cancel/status transitions
  - add item and remove item
- Products:
  - list/search/category filtering
  - create with initial inventory
  - duplicate SKU error
  - edit and archive/delete flow
- Team and invite flows:
  - team page list/filter/detail for authorized roles
  - invite member
  - resend invite, role update, location update, deactivate/reactivate
  - invite resolve states: valid, expired, invalid
  - invite acceptance for new-user and authenticated existing-user flows

## Docs Update
- Extend [`docs/integration-tests.md`](/Users/rawad663/Projects/ledger-light-admin/docs/integration-tests.md) to this shape:
  - `# 1. Backend`
  - `# 2. Frontend`
- The new frontend section should mirror backend subsections closely:
  - `What The Frontend Suite Covers`
  - `Prerequisites`
  - `How To Run Frontend Integration Tests`
  - `What Happens During The Run`
  - `Test Isolation Rules`
  - `Writing New Frontend Integration Tests`
  - `Artifacts`
  - `CI`
  - `Notes`
- Document the exact artifact/report paths and explain that CI uploads traces, videos, screenshots, and the HTML report for failure debugging.

## Test Plan
- Specs live under `frontend/test/integration/`, grouped by domain.
- Each spec loads one named scenario and drives the real browser against the built app.
- Assertions cover rendered state, redirects, URL params, modal/sheet flows, auth cookie behavior, inline/toast error handling, and post-mutation UI refresh.
- Validation target:
  - `npm run lint`
  - `npm run test:run`
  - `npm run build`
  - `npm run test:integration:ci`

## Assumptions and Defaults
- This suite complements Vitest tests; it does not replace them.
- Chromium-only Playwright coverage is sufficient for v1.
- A mock backend server is required because many frontend routes fetch server-side through `createApi()`.
- Sequential execution is preferred for stability and easier artifact inspection.
