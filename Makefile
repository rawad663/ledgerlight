.PHONY: \
	env-check \
	dev-up dev-build dev-down dev-migrate dev-seed dev-logs \
	qa-up qa-build qa-down qa-migrate qa-seed qa-logs \
	prod-up prod-build prod-down prod-migrate prod-logs

define compose_cmd
docker compose --env-file .env.$(1) -f docker-compose.yml -f docker-compose.$(1).yml -p ledgerlight-$(1)
endef

env-check:
	./scripts/check-environment-config.sh

# ── Development ──────────────────────────────────────────────────────────────
dev-up:
	$(call compose_cmd,dev) up -d

dev-build:
	$(call compose_cmd,dev) up -d --build

dev-down:
	$(call compose_cmd,dev) down --remove-orphans

dev-migrate:
	$(call compose_cmd,dev) --profile tools run --rm --build migrate

dev-seed:
	$(call compose_cmd,dev) --profile tools run --rm --build migrate npx tsx prisma/seed.ts

dev-logs:
	$(call compose_cmd,dev) logs -f backend

dev-prisma-studio:
	cd backend && DATABASE_URL="postgres://postgres:postgres@localhost:5432/ledgerlight?sslmode=disable" npx prisma studio

# ── QA ───────────────────────────────────────────────────────────────────────
qa-up:
	$(call compose_cmd,qa) up -d

qa-build:
	$(call compose_cmd,qa) up -d --build

qa-down:
	$(call compose_cmd,qa) down --remove-orphans

qa-migrate:
	$(call compose_cmd,qa) --profile tools run --rm --build migrate

qa-seed:
	$(call compose_cmd,qa) --profile tools run --rm --build migrate npx tsx prisma/seed.demo.ts

qa-logs:
	$(call compose_cmd,qa) logs -f backend

qa-prisma-studio:
	cd backend && DATABASE_URL="postgres://postgres:postgres@localhost:5433/ledgerlight_demo?sslmode=disable" npx prisma studio

# ── Production ───────────────────────────────────────────────────────────────
prod-up:
	$(call compose_cmd,prod) up -d

prod-build:
	$(call compose_cmd,prod) up -d --build

prod-down:
	$(call compose_cmd,prod) down --remove-orphans

prod-migrate:
	$(call compose_cmd,prod) --profile tools run --rm --build migrate

prod-logs:
	$(call compose_cmd,prod) logs -f backend
