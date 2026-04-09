# Ledger Light Admin (Monorepo)

Monorepo structure:
- `backend/` Node API
- `frontend/` (reserved)

### Prereqs
- Docker + Docker Compose

### Getting Started
```bash
cp .env.dev.example .env.dev
cp .env.qa.example .env.qa
cp .env.prod.example .env.prod

make dev-build
make dev-migrate
make dev-seed
```

### Swagger Docs
Available at `http://localhost:8080/docs` for dev and `http://localhost:8081/docs` for QA.

### Environment Guide
See [docs/ENVIRONMENTS.md](docs/ENVIRONMENTS.md) for the full dev / QA / prod Docker workflow, environment files, ports, and migration / seed commands.

The frontend now reads `NEXT_PUBLIC_API_URL` from the same root environment files as the backend. `frontend/.env.local` and `frontend/.env.production` are no longer used. Local development prefers `.env.dev`, `.env.qa`, and `.env.prod`, while CI/build-only environments can safely fall back to the committed `*.example` files.

### Team Permissions & Role Management
- Team access is membership-based per organization, so the same user can hold different roles in different orgs.
- `OWNER` has full access, `MANAGER` can invite/manage lower-tier members, and lower-tier roles do not have team-management access.
- Memberships can be scoped to selected locations; no assigned locations means full organization access.
- Only `ACTIVE` memberships are included in auth context, while `INVITED` and `DEACTIVATED` remain available for team workflows and audit history.

See [docs/team-role-management.md](docs/team-role-management.md) for the detailed role, permission, tier, invite, and location-scoping rules.

## 1. Security & Production Readiness Strategy

The backend follows a layered security approach — authentication, authorization, input validation, and infrastructure hardening — designed to work across both development and production environments.

### 1.1 Authentication & Authorization

Every request flows through a guard chain:

1. **JwtAuthGuard** — validates the Bearer token (15-minute expiry, HS256)
2. **OrganizationContextGuard** — reads the `X-Organization-Id` header and verifies the user has a membership in that org
3. **PermissionsGuard** — derives the user's permitted actions from a `ROLE_PERMISSIONS` map and enforces them against the endpoint's declared requirements

These are composed via `@OrgProtected()` at the controller level and `@RequirePermissions(Permission.X)` (all-of) or `@RequireAnyPermission(Permission.X)` (any-of) at the method level.

User memberships are embedded directly in the JWT payload to avoid a database query on every request; they stay fresh because tokens expire after 15 minutes.

Passwords are hashed with `bcryptjs` (async), and refresh tokens are stored as bcrypt hashes with expiration and revocation support.

### 1.2 Role-Based Access Control (RBAC)

The system uses five roles with granular, capability-scoped permissions:

| Role | Description |
|------|-------------|
| `OWNER` | Full access (wildcard `*`) |
| `MANAGER` | Full operational access across all domains |
| `CASHIER` | Sales-focused — can sell and fulfill but cannot cancel, refund, or delete |
| `SUPPORT` | Read-only across all domains |
| `INVENTORY_CLERK` | Inventory read and adjustment only |

Permissions are grouped by domain (e.g. `orders.read`, `orders.transition.cancel`, `inventory.adjust`) and evaluated per organization membership, so a user can have different roles in different organizations.

See [plans/RBAC Implementation Plan.md](plans/RBAC%20Implementation%20Plan.md) for the full permission matrix, architecture decisions, and migration details.

### 1.3 Input Validation & Query Safety

A global `ValidationPipe` is configured with `whitelist: true` and `forbidNonWhitelisted: true`, meaning unknown fields are rejected outright. Every DTO uses `class-validator` decorators (`@IsEmail`, `@Min(0)`, `@IsUUID`, etc.) for type-safe validation at the boundary.

All database access goes through Prisma ORM — there are no raw SQL queries with user input, eliminating SQL injection as a vector.

### 1.4 Rate Limiting & Security Headers

Rate limiting is applied globally via `@nestjs/throttler` (100 requests/minute per client). The login endpoint has a stricter limit of 5 attempts per 15 minutes to guard against brute-force attacks.

The `helmet` middleware sets standard security headers (CSP, X-Frame-Options, HSTS, etc.) on all responses.

### 1.5 Data Integrity

Operations that touch multiple tables are wrapped in Prisma interactive transactions (`$transaction`). For example:
- **Order creation** — creates the order, validates product snapshots, and inserts all line items atomically
- **Inventory adjustments** — finds-or-creates the inventory level, updates the quantity, and logs the adjustment in one transaction
- **Product creation with initial stock** — creates the product, inventory level, and adjustment together

### 1.6 Multi-Tenancy

All domain queries are scoped by `organizationId`. The schema enforces this with composite indexes and unique constraints (e.g., SKU is unique *per organization*, not globally). The `OrganizationContextGuard` validates membership before any data access occurs, preventing cross-tenant leakage.

### 1.7 Environment & Configuration

| Variable | Purpose |
|----------|---------|
| `JWT_ACCESS_SECRET` | **Required.** Signing key for JWTs — app fails to start if missing |
| `DATABASE_URL` | PostgreSQL connection string (use `sslmode=require` in production) |
| `CORS_ORIGINS` | Comma-separated allowed origins (`*` for dev) |
| `DB_POOL_MAX` | Connection pool size (default: `10`) |

Configuration is loaded via `@nestjs/config` (global `ConfigModule`). Sensitive values like the JWT secret use `getOrThrow()` so misconfigurations surface immediately at startup.

### 1.8 Environment Layout

The same codebase supports explicit `dev`, `qa`, and `prod` environments through Docker Compose layering:

```bash
make dev-build       # hot reload + local Postgres on 5432 + backend on 8080
make qa-build        # production-mode backend + local Postgres on 5433 + backend on 8081
make prod-build      # skeletal production overlay on 8082, awaiting real prod credentials
```

The Dockerfile has four stages:
- **builder** — installs all deps, generates Prisma client, compiles TypeScript
- **development** — full source with dev dependencies for hot-reload
- **migrations** — Prisma CLI + schema + seed sources for one-shot migrate / seed operations
- **production** — copies only `dist/` and production `node_modules`, runs as a non-root `nestjs` user

Environment-specific commands are driven by `.env.dev`, `.env.qa`, and `.env.prod`, each paired with a shared base compose file plus an environment overlay. Dev and QA can run at the same time because they use separate Compose project names, database ports, and backend ports.

In production mode, `helmet`, `compression`, CORS, and graceful shutdown hooks (`enableShutdownHooks()`) are all active. The connection pool is configurable via environment variables for tuning under load. QA uses the same production runtime path as prod, plus the dedicated `migrate` service because the production runtime image intentionally does not carry the Prisma CLI or migration files.
