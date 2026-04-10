# Environments

## Overview

Ledger Light Admin uses explicit Docker environments instead of mutating a shared root `.env` file. Each environment is started with:

- the shared base file: `docker-compose.yml`
- an environment overlay: `docker-compose.dev.yml`, `docker-compose.qa.yml`, or `docker-compose.prod.yml`
- an environment file: `.env.dev`, `.env.qa`, or `.env.prod`

Dev and QA can run at the same time because each environment uses a separate Compose project name, backend port, and database port.

| Environment | Runtime mode | Backend port | Database port | Container `DATABASE_URL` |
|---|---|---:|---:|---|
| `dev` | `development` | `8080` | `5432` | `postgres://postgres:postgres@db:5432/ledgerlight?sslmode=disable` |
| `qa` | `production` | `8081` | `5433` | `postgres://postgres:postgres@db:5432/ledgerlight_demo?sslmode=disable` |
| `prod` | `production` | `8082` | external | placeholder only until real prod values are supplied |

## Environment Files

Committed templates live at:

- `.env.dev.example`
- `.env.qa.example`
- `.env.prod.example`

Create local copies before running commands:

```bash
cp .env.dev.example .env.dev
cp .env.qa.example .env.qa
cp .env.prod.example .env.prod
```

The live files are ignored by Git. The root `.env` workflow is retired.

The frontend also reads its environment from these same root files. `frontend/.env.local` and `frontend/.env.production` are no longer part of the supported setup.
When a local `.env.<env>` file is missing, the frontend falls back to the committed `.env.<env>.example` file. That keeps CI and build-only workflows working without requiring secret local env files.
The backend now also reads the root `.env.<env>` files when run directly from `backend/`. It defaults to `.env.dev`, switches to `.env.prod` when `NODE_ENV=production`, and honors `LEDGERLIGHT_ENV=<dev|qa|prod>` when you want to force a specific root env file.

### Payment-related variables

All three committed env templates now include the Stripe variables needed by the
payments module:

- `STRIPE_SECRET_KEY`
  - backend server-side Stripe API access
- `STRIPE_WEBHOOK_SECRET`
  - backend verification for `POST /payments/webhooks/stripe`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
  - frontend Stripe Elements initialization for card collection

Use Stripe test credentials in local dev and QA. The current implementation is
card-only and hardcodes payment currency to `CAD`.
The Docker Compose backend service now forwards `STRIPE_SECRET_KEY` and
`STRIPE_WEBHOOK_SECRET` from the selected root env file into the running
container as well.

## Development

Use the dev stack for local feature work and watch mode:

```bash
make dev-build
make dev-migrate
make dev-seed
```

Details:

- Backend runs with the Dockerfile `development` target and `NODE_ENV=development`.
- PostgreSQL runs inside the dev stack on host port `5432`.
- Swagger is available at `http://localhost:8080/docs`.
- `NEXT_PUBLIC_API_URL` comes from `.env.dev`.
- Payment dialogs also read `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` from `.env.dev`.

To run the frontend against dev from `frontend/`:

```bash
cd frontend && LEDGERLIGHT_ENV=dev npm run dev
```

## QA

QA is the replacement for the old demo workflow. It is self-contained and runs the backend in production mode while still using a local PostgreSQL container.

```bash
make qa-build
make qa-migrate
make qa-seed
```

Details:

- Backend runs with the Dockerfile `production` target and `NODE_ENV=production`.
- PostgreSQL runs inside the QA stack on host port `5433`.
- Swagger is available at `http://localhost:8081/docs`.
- Host-side direct access uses `postgres://postgres:postgres@localhost:5433/ledgerlight_demo?sslmode=disable`.
- Container-side access uses `postgres://postgres:postgres@db:5432/ledgerlight_demo?sslmode=disable`.
- `make qa-seed` runs `backend/prisma/seed.demo.ts`, which still provides the large realistic QA/demo dataset.
- The QA seed now generates coherent payment and refund states:
  - `PENDING` orders without payments
  - confirmed unpaid / pending / failed / paid orders
  - fulfilled paid / refunded / refund-pending / refund-failed orders
  - cancelled orders both before confirmation and after payment/refund flows
- `NEXT_PUBLIC_API_URL` comes from `.env.qa`.

To run the frontend against QA from `frontend/`:

```bash
cd frontend && LEDGERLIGHT_ENV=qa npm run dev
```

The QA database keeps the previous demo database tuning flags to speed up large reseeds. Those flags are appropriate for local QA/demo data only and should not be copied into a real production database.

### Resetting QA Data

To wipe the QA database and start fresh:

```bash
docker compose --env-file .env.qa -f docker-compose.yml -f docker-compose.qa.yml -p ledgerlight-qa down -v
make qa-build
make qa-migrate
make qa-seed
```

### QA Credentials

The seeded QA/demo users still share the same password:

```text
DemoPass123!
```

User emails still follow the `firstname.lastnameN@orgslug.demo` pattern from the QA seed data.

## Production

The production overlay is intentionally skeletal for now:

- `docker-compose.prod.yml` runs the production backend image and the one-shot `migrate` service.
- No local PostgreSQL service is included.
- `.env.prod` must be updated with real database credentials and secrets before `make prod-up` or `make prod-migrate` is usable.

Current commands:

```bash
make prod-build
make prod-migrate
```

If you build or start the frontend in production mode, it will read `NEXT_PUBLIC_API_URL` from `.env.prod` by default. You can also force a different root environment with `LEDGERLIGHT_ENV=<dev|qa|prod>`.
The production env file must also supply real Stripe keys before payment collection can work.

## Migrations and Seeds

All environments share the same one-shot `migrate` service pattern:

- `make dev-migrate` runs `prisma migrate dev`
- `make qa-migrate` runs `prisma migrate deploy`
- `make prod-migrate` runs `prisma migrate deploy`

The production runtime image does not ship the Prisma CLI or migration files. That is why QA and prod use the dedicated `migrate` service instead of running migrations inside the backend container.

Seed commands:

- `make dev-seed` runs `prisma/seed.ts`
- `make qa-seed` runs `prisma/seed.demo.ts`

## Known QA / Prod Notes

- The frontend auth routes and middleware now decide `secure` cookie behavior from the request protocol instead of `NODE_ENV` alone. That keeps local QA `next start` testing working on `http://127.0.0.1` while still marking cookies secure behind HTTPS.
- `qa` is now the only supported replacement for the old `demo` environment. Old `demo-*` commands and the root `.env` switching flow are removed.
