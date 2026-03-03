# Ledger Light Admin (Monorepo)

Monorepo structure:
- `backend/` Node API
- `frontend/` (reserved)

## Prereqs
- Docker + Docker Compose

## Getting Started
```bash
cp .env.example .env
docker compose up --build
make run-migrations
make run-seed
```

## Swagger Docs
Available at `http://localhost:8080/docs`