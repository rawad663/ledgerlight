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