# AGENTS.md

## Project Overview

Ledger Light Admin is a multi-tenant SaaS admin panel built as a monorepo:

- **Backend**: NestJS 11, TypeScript, Prisma 7.4, PostgreSQL
- **Frontend**: Next.js 16, React 19, Tailwind CSS, shadcn/ui
- **Testing**: Jest 30 (backend), Vitest (frontend)

## Quick Start

```bash
cp .env.dev.example .env.dev
cp .env.qa.example .env.qa
cp .env.prod.example .env.prod

make dev-build              # Start the dev environment (Docker)
make dev-migrate            # Run Prisma migrations in dev
make dev-seed               # Seed the dev database

make qa-build               # Start the QA environment in production mode
make qa-migrate             # Run deploy-style migrations in QA
make qa-seed                # Seed the QA/demo database

# Backend
cd backend && npm test       # Run tests (watch)
cd backend && npm run test:run  # Run tests (single run)
cd backend && npm run test:cov  # Coverage report

# Frontend
cd frontend && npm run test:run
```

Swagger docs: `http://localhost:8080/docs` for dev and `http://localhost:8081/docs` for QA

The frontend reads `NEXT_PUBLIC_API_URL` from the root `.env.dev`, `.env.qa`, and `.env.prod` files. `frontend/.env.local` and `frontend/.env.production` are retired.

## Must-Do On Every Run

These duties are non-optional for every agent run that changes repository-tracked state.

1. **Tests must move with behavior**: Every repository change that affects behavior MUST add or update the relevant tests. This includes unit tests and integration tests whenever the changed behavior is exercised at that level.
2. **Tests are the source of truth**: Agents MUST treat tests as the authoritative definition of expected behavior. Behavior-changing work is incomplete until the tests reflect the latest functionality.
3. **Docs must move with the code**: Every repository change MUST update the relevant documentation under `docs/` so the docs match the current repository state, not just the delta introduced by the current change.
4. **Every module needs a doc**: Each backend domain module and each top-level frontend feature module MUST have a corresponding `.md` file under `docs/`.
5. **Backfill missing module docs**: If a touched module does not already have a doc, the agent MUST create one and document the module as it exists today, not only the newly added behavior.
6. **Keep existing module docs current**: If a touched module already has a doc, the agent MUST update it to reflect the module’s current behavior, interfaces, rules, and constraints.

## Repository Layout

```
backend/
  src/
    domain/[name]/          # Domain modules (module, controller, service, dto, specs)
    common/                 # Decorators, guards, filters, interceptors, middlewares, DTOs, permissions
    infra/prisma/           # PrismaService, PrismaModule
    test-utils/             # Prisma mocks, fixtures, setup, validation helpers
  prisma/                   # schema.prisma, migrations/, seed.ts
frontend/
  src/
    app/                    # Next.js App Router pages
    components/             # UI components (shared/, ui/, feature-specific/)
    hooks/                  # Custom hooks (use-api, use-cursor-pagination, etc.)
    lib/                    # Utilities, formatters, generated API types
mcp-server/
  src/
    auth/                   # TokenManager (3-tier login/refresh/cache), ToolContext, header builder
    client/                 # Axios singleton, AxiosError → McpError mapper
    logger/                 # Pino structured logger, logToolCall helper
    tools/                  # One file per MCP tool (7 tools)
    config.ts               # Zod-validated env config
    server.ts               # McpServer construction + tool registration
    index.ts                # stdio entry point (node dist/index.js)
  test/                     # Jest unit tests (per-tool + token-manager + error-mapper)
docs/                       # Conventions and feature design documents
  convensions/
    BACKEND_CONVENTIONS.md
    FRONTEND_CONVENTIONS.md
    MCP_SERVER_CONVENTIONS.md   # Tool naming, Zod schema rules, auth forwarding, logging, testing
  MCP_SERVER.md               # Architecture, auth flow, tool catalog, local dev setup
```

## Principles

### Consistency

Every change must build on the patterns already established in the codebase. Before writing new code:

1. Read at least one existing module that does something similar.
2. Follow the same file structure, naming, decorator usage, and testing patterns.
3. Reuse existing utilities (location scoping, pagination, permissions) rather than creating new abstractions.

### Test-Driven

All features must be covered by tests. Testing is not optional and not an afterthought.

1. Every behavior change MUST add or update the relevant tests before the work is considered complete.
2. Every backend domain module ships with `[name].service.spec.ts` and `[name].controller.spec.ts`.
3. Every frontend feature ships with tests for hooks, utilities, and components that contain logic or affect behavior.
4. Integration tests MUST be added or updated whenever the changed behavior is exercised at the integration level.
5. Test scenarios must cover happy paths, edge cases, validation failures, permission denials, and multi-tenant isolation.
6. Every new or changed module must have matching documentation under `docs/` (see Documentation Rules below).

## Conventions Reference

- Backend patterns: [docs/convensions/BACKEND_CONVENTIONS.md](docs/convensions/BACKEND_CONVENTIONS.md)
- Frontend patterns: [docs/convensions/FRONTEND_CONVENTIONS.md](docs/convensions/FRONTEND_CONVENTIONS.md)
- MCP server patterns: [docs/convensions/MCP_SERVER_CONVENTIONS.md](docs/convensions/MCP_SERVER_CONVENTIONS.md)
- MCP server architecture: [docs/MCP_SERVER.md](docs/MCP_SERVER.md)
- Project architecture: [docs/domains/*](docs/domains)

## Security Invariants

These rules must never be violated. Breaking any of them is a data-leak or privilege-escalation risk.

1. **Org-scoped queries**: Every query on tenant data MUST include `organizationId` in the where clause.
2. **Controller protection**: Every org-scoped controller MUST use `@OrgProtected()` at the class level.
3. **Permission declarations**: Every endpoint MUST declare permissions via `@RequirePermissions()` or `@RequireAnyPermission()`. The guard default-denies routes without declared permissions.
4. **Location scoping**: Location-scoped members MUST be filtered using `getLocationScopeWhere()` and validated with `ensureLocationAccessible()`.
5. **Audit logging**: All write operations MUST record audit logs with before/after JSON snapshots.
6. **Transactions**: Multi-step write operations MUST use `prisma.$transaction()`.
7. **Input validation**: DTOs MUST use class-validator decorators. The global ValidationPipe rejects unknown fields (`whitelist: true`, `forbidNonWhitelisted: true`).
8. **Error responses**: Never expose internal error details in HTTP responses. The `AllExceptionsFilter` handles this.

## Code Generation Rules

### Backend

- **Module structure**: `domain/[name]/` with `module.ts`, `controller.ts`, `service.ts`, `dto.ts`, and spec files.
- **Controllers are thin**: Route handler + decorators + delegation to service. No business logic, no database calls.
- **Services are thick**: All business logic lives here. Inject `PrismaService` directly (no repository layer).
- **Organization scope**: Services accept `organization: CurrentOrg | string` as first parameter. Normalize with `resolveOrganizationScope(organization)` at the top of every method.
- **Location scoping**: Use `hasRestrictedLocations()`, `getLocationScopeWhere()`, and `ensureLocationAccessible()` from `common/organization/location-scope.ts`.
- **Pagination**: Use `PrismaService.paginateMany()` with cursor encoding. Return `{ data, totalCount, nextCursor }`.
- **Swagger**: Use `@ApiDoc()` composite decorator (not raw `@ApiOperation` + `@ApiResponse`).
- **Money**: Stored as integer cents (`priceCents`, `totalCents`). Never floats.
- **Compound keys**: Use `id_organizationId` for `findUnique`/`update`/`delete` where available.

### Frontend

- See [docs/FRONTEND_CONVENTIONS.md](docs/FRONTEND_CONVENTIONS.md) for full rules.
- Use generated API types from `lib/api-types.ts` (never hand-maintain backend response shapes).
- Use `useApiClient()` for client-side requests and `createApi()` for server-side.
- Use `react-hook-form` + Zod for non-trivial forms.
- Keep route files thin; extract dense UI into feature subcomponents.

## Test Integrity

**Tests are the source of truth for business logic.** An agent must NEVER:

- Remove or weaken assertions to make a failing test pass.
- Mock data that doesn't correspond to real codebase structures or Prisma schema.
- Skip, disable, or comment out failing tests.
- Reduce test coverage to avoid dealing with edge cases.
- Leave changed behavior without corresponding unit or integration test updates where they apply.

**If behavior changes, the tests must change with it.** If a test fails, fix the implementation — not the test, unless the test is incomplete or no longer reflects the intended behavior. In either case, the resolution must increase correctness and keep tests authoritative.

## Testing Rules

### Backend

- Use `createPrismaMock()` from `test-utils/prisma.mock.ts` for database mocking.
- Use `Test.createTestingModule()` from `@nestjs/testing` for DI setup.
- Transaction mocking: pass a separate `tx` mock: `const tx = createPrismaMock(); const prisma = createPrismaMock(tx);`
- When testing org-scoped methods with a plain string orgId, `resolveOrganizationScope` defaults to OWNER with `hasAllLocations: true`.
- To test location-restricted behavior, pass a full `CurrentOrg` object: `{ membershipId, organizationId, role, hasAllLocations: false, allowedLocationIds: [...] }`.
- Controller tests: mock the service entirely, verify delegation and error propagation.
- Service tests: mock PrismaService methods, test business logic branches.

### Frontend

- Use Vitest + `@testing-library/react` for component tests.
- Shared utilities and hooks that affect behavior should ship with focused tests.

## Documentation Rules

Documentation under `docs/` must reflect the current state of the repository. Agents are responsible for keeping docs aligned with the implementation on every change.

### Required Module Docs

- Every backend domain module under `backend/src/domain/` must have a corresponding `.md` file under `docs/`.
- Every top-level frontend feature module must have a corresponding `.md` file under `docs/`. This includes feature areas such as auth, dashboard, customers, inventory, locations, orders, products, team/invite, and similar feature-level modules.
- Prefer one module per doc file.
- Use stable, feature- or domain-oriented filenames under `docs/` so future changes update the same file instead of creating duplicates.
- If a touched module has no existing doc, create it and document the module’s current state.
- If a touched module already has a doc, update it rather than creating a parallel replacement.

### Expected Doc Contents

Every new or updated module doc should include the module’s current:

- **Data model**: Entities, relationships, enums, and constraints.
- **Endpoints**: Routes, HTTP methods, request/response shapes, permissions required.
- **Business rules**: Validation rules, state transitions, edge cases.
- **Permission model**: Which roles can perform which actions.

Use `docs/team-role-management.md` as a reference for format and depth until a more formal documentation template exists.

## Common Mistakes

- **Missing `organizationId` in queries** — cross-tenant data leak.
- **Creating a repository layer** — services use PrismaService directly.
- **Using floats for money** — use integer cents.
- **Business logic in controllers** — controllers only validate, extract params, and delegate.
- **Using `findUnique` without org scoping** — use compound where (`id_organizationId`) or `findFirst` with `organizationId`.
- **Skipping audit logging on mutations** — every write needs an audit log.
- **Adding permissions without updating mappings** — new permissions must go in `permissions.ts` AND `role-permissions.ts`.
- **Forgetting AppModule registration** — new modules must be imported in `app.module.ts`.
- **Hand-editing migration SQL** — use `npx prisma migrate dev --name descriptive_name`.

## PR Checklist

Before considering work complete, verify:

- [ ] All queries on tenant data include `organizationId` in the where clause.
- [ ] Controllers use `@OrgProtected()` and declare permissions on every method.
- [ ] Write operations include audit logging.
- [ ] Multi-step writes are wrapped in `$transaction()`.
- [ ] DTOs have class-validator decorators and are documented with `@ApiProperty` where needed.
- [ ] Service spec and controller spec files exist and cover happy paths + error cases.
- [ ] Unit tests and integration tests were added or updated for every changed behavior where applicable.
- [ ] `npm run lint`, `npm run test:run`, and `npm run build` all pass in `backend/`.
- [ ] Frontend changes pass `npm run lint`, `npm run test:run`, and `npm run build` in `frontend/`.
- [ ] Relevant docs under `docs/` were created or updated to reflect the latest implementation.
- [ ] Every touched backend domain module and top-level frontend feature module has a corresponding `.md` file under `docs/`.
- [ ] New modules are registered in `app.module.ts`.
- [ ] New permissions are added to `permissions.ts` and granted to roles in `role-permissions.ts`.
