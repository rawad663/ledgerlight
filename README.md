# Ledger Light Admin (Monorepo)

Monorepo structure:
- `backend/` Node API
- `frontend/` (reserved)

### Prereqs
- Docker + Docker Compose

### Getting Started
```bash
cp .env.example .env
docker compose up --build
make run-migrations
make run-seed
```

### Swagger Docs
Available at `http://localhost:8080/docs`

## 1. Security & Production Readiness Strategy

The backend follows a layered security approach — authentication, authorization, input validation, and infrastructure hardening — designed to work across both development and production environments.

### 1.1 Authentication & Authorization

Every request flows through a guard chain:

1. **JwtAuthGuard** — validates the Bearer token (15-minute expiry, HS256)
2. **OrganizationContextGuard** — reads the `X-Organization-Id` header and verifies the user has a membership in that org
3. **RolesGuard** — checks the user's role (`ADMIN`, `MANAGER`, `SUPPORT`) against the endpoint's requirements

These are composed via decorators like `@OrgProtected()` and `@Authorized('ADMIN', 'MANAGER')`, which stack the appropriate guards automatically. User memberships are embedded directly in the JWT payload to avoid a database query on every request; they stay fresh because tokens expire after 15 minutes.

Passwords are hashed with `bcryptjs` (async), and refresh tokens are stored as bcrypt hashes with expiration and revocation support.

### 1.2 Input Validation & Query Safety

A global `ValidationPipe` is configured with `whitelist: true` and `forbidNonWhitelisted: true`, meaning unknown fields are rejected outright. Every DTO uses `class-validator` decorators (`@IsEmail`, `@Min(0)`, `@IsUUID`, etc.) for type-safe validation at the boundary.

All database access goes through Prisma ORM — there are no raw SQL queries with user input, eliminating SQL injection as a vector.

### 1.3 Rate Limiting & Security Headers

Rate limiting is applied globally via `@nestjs/throttler` (100 requests/minute per client). The login endpoint has a stricter limit of 5 attempts per 15 minutes to guard against brute-force attacks.

The `helmet` middleware sets standard security headers (CSP, X-Frame-Options, HSTS, etc.) on all responses.

### 1.4 Data Integrity

Operations that touch multiple tables are wrapped in Prisma interactive transactions (`$transaction`). For example:
- **Order creation** — creates the order, validates product snapshots, and inserts all line items atomically
- **Inventory adjustments** — finds-or-creates the inventory level, updates the quantity, and logs the adjustment in one transaction
- **Product creation with initial stock** — creates the product, inventory level, and adjustment together

### 1.5 Multi-Tenancy

All domain queries are scoped by `organizationId`. The schema enforces this with composite indexes and unique constraints (e.g., SKU is unique *per organization*, not globally). The `OrganizationContextGuard` validates membership before any data access occurs, preventing cross-tenant leakage.

### 1.6 Environment & Configuration

| Variable | Purpose |
|----------|---------|
| `JWT_ACCESS_SECRET` | **Required.** Signing key for JWTs — app fails to start if missing |
| `DATABASE_URL` | PostgreSQL connection string (use `sslmode=require` in production) |
| `CORS_ORIGINS` | Comma-separated allowed origins (`*` for dev) |
| `DB_POOL_MAX` | Connection pool size (default: `10`) |

Configuration is loaded via `@nestjs/config` (global `ConfigModule`). Sensitive values like the JWT secret use `getOrThrow()` so misconfigurations surface immediately at startup.

### 1.7 Dev vs Production

The same codebase supports both environments through Docker Compose layering:

```bash
make dev-build       # uses docker-compose.override.yml → hot-reload, volume mounts
make prod-build      # uses docker-compose.prod.yml → multi-stage build, non-root user, node dist/main
```

The Dockerfile has three stages:
- **builder** — installs all deps, generates Prisma client, compiles TypeScript
- **production** — copies only `dist/` and production `node_modules`, runs as a non-root `nestjs` user
- **development** — full source with dev dependencies for hot-reload

In production, `helmet`, `compression`, CORS, and graceful shutdown hooks (`enableShutdownHooks()`) are all active. The connection pool is configurable via environment variables for tuning under load.
