.PHONY: up down build logs

up:
	docker compose up

up-build:
	docker compose up --build

up-build-migrate:
	docker compose up --build --wait
	make run-migrations

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f

run-migrations:
	docker compose exec backend npx prisma migrate dev

# Mark a migration as applied (adds row into _prisma_migrations table in db)
# docker compose exec backend npx prisma migrate resolve --applied name_of_migration

run-seed:
	docker compose exec backend npx tsx prisma/seed.ts