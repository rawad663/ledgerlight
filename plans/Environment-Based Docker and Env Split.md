# Environment-Based Docker and Env Split

## Summary
- Replace the current single mutable `.env` plus `override/demo/prod` mix with a shared Compose base and three explicit environment overlays: `dev`, `qa`, and `prod`.
- Make `dev` and `qa` runnable at the same time on one machine by using separate Compose project names, removing fixed `container_name` values, and reserving distinct host ports.
- Treat `qa` as the renamed replacement for the current demo flow, with no compatibility aliases.

## Key Changes
### Compose layout
- Keep `docker-compose.yml` as the shared base for common services only.
- Create `docker-compose.dev.yml` for the local dev stack:
  - Add a local `db` service with host port `5432`, database `ledgerlight`, and its own named volume.
  - Run `backend` from the Dockerfile `development` target with bind mounts, `start:dev`, and `NODE_ENV=development`.
- Create `docker-compose.qa.yml` for the QA stack:
  - Add a local `db` service with host port `5433`, database `ledgerlight_demo`, and its own named volume.
  - Run `backend` from the Dockerfile `production` target with `NODE_ENV=production`.
  - Keep QA self-contained; the backend uses Compose-internal DB DNS (`db:5432`) while host-side tooling uses `localhost:5433`.
- Keep `docker-compose.prod.yml` as a minimal production overlay only:
  - Use the production image and prod-mode settings.
  - Do not add a local Postgres service yet.
  - Leave real prod credentials and database wiring as placeholders.

### Env files and values
- Move away from root `.env` switching entirely.
- Add committed templates: `.env.dev.example`, `.env.qa.example`, `.env.prod.example`.
- Use local ignored files: `.env.dev`, `.env.qa`, `.env.prod`.
- Update `.gitignore` so the new `*.example` files are tracked while real env files stay ignored.
- Set these defaults:
  - Dev DB URL: `postgres://postgres:postgres@db:5432/ledgerlight?sslmode=disable`
  - QA DB URL inside Docker: `postgres://postgres:postgres@db:5432/ledgerlight_demo?sslmode=disable`
  - QA DB URL from the host: `postgres://postgres:postgres@localhost:5433/ledgerlight_demo?sslmode=disable`
  - Dev backend port: `8080`
  - QA backend port: `8081`
  - Prod placeholder backend port: `8082`

### Makefile interface
- Replace the current targets with environment-specific commands built on a shared macro using:
  - `--env-file .env.<env>`
  - `-f docker-compose.yml -f docker-compose.<env>.yml`
  - `-p ledgerlight-<env>`
- Expose explicit targets:
  - `dev-up`, `dev-build`, `dev-down`, `dev-migrate`, `dev-seed`
  - `qa-up`, `qa-build`, `qa-down`, `qa-migrate`, `qa-seed`
  - `prod-up`, `prod-build`, `prod-down`, `prod-migrate`
- Remove `docker-compose.override.yml`, `docker-compose.demo.yml`, and all `.env` rewrite targets such as `use-demo`, `use-dev`, `switch-demo`, and `switch-dev`.

### QA/prod migration path
- Add a dedicated Dockerfile stage for migrations that includes the Prisma CLI plus `prisma/schema.prisma` and `prisma/migrations`.
- Add a one-shot Compose `migrate` service:
  - Dev runs `prisma migrate dev`
  - QA and prod run `prisma migrate deploy`
- Keep seeding environment-specific:
  - Dev uses `prisma/seed.ts`
  - QA uses `prisma/seed.demo.ts`

### Docs
- Update `README.md` to document the new environment model, commands, ports, and startup flow.
- Replace `docs/DEMO_DATABASE.md` with a broader environment doc such as `docs/ENVIRONMENTS.md` covering dev, qa, and prod.
- Document that `qa` is the replacement for the old demo workflow.

## Public Interfaces
- New user-facing files:
  - `docker-compose.dev.yml`
  - `docker-compose.qa.yml`
  - `.env.dev.example`
  - `.env.qa.example`
  - `.env.prod.example`
- New user-facing commands:
  - `make dev-*`
  - `make qa-*`
  - `make prod-*`
- Retired interfaces:
  - `demo-*` targets
  - `.env` switching workflow
  - `docker-compose.override.yml`
  - `docker-compose.demo.yml`

## QA Prod-Mode Gaps To Close
- The current production image cannot run Prisma migrations because it does not ship the Prisma CLI or migration files. The new `migrate` service is required for QA-in-prod-mode to be operational.
- QA will run only the backend in production mode under this plan. If local full-stack QA later runs the frontend in production mode too, auth cookies will become `secure`, so local HTTP testing would need HTTPS or a QA-specific frontend override.

## Test Plan
- Validate config generation for all three envs with `docker compose ... config`.
- Verify `dev` and `qa` can start together without name or port collisions.
- Verify `curl http://localhost:8080/health` succeeds for dev.
- Verify `curl http://localhost:8081/health` succeeds for QA.
- Verify `dev-migrate` uses `prisma migrate dev` and `qa-migrate` uses `prisma migrate deploy`.
- Verify `qa-seed` populates `ledgerlight_demo` and does not touch the dev database.
- Verify the README and environment doc match the final file names and commands.

## Assumptions
- `dev` and `qa` must be runnable simultaneously on the same machine.
- `qa` is a hard rename of the old demo flow, with no compatibility aliases kept.
- QA should be self-contained rather than using `host.docker.internal` at runtime; the host port `5433` remains available for direct host access.
- `prod` stays intentionally skeletal for now, with placeholders instead of real secrets or database connectivity.
