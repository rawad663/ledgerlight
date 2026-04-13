#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

assert_contains() {
  local haystack="$1"
  local needle="$2"
  local message="$3"

  if [[ "$haystack" != *"$needle"* ]]; then
    echo "check failed: $message" >&2
    exit 1
  fi
}

dev_config="$(docker compose --env-file .env.dev.example -f docker-compose.yml -f docker-compose.dev.yml -p ledgerlight-dev-test --profile tools config)"
qa_config="$(docker compose --env-file .env.qa.example -f docker-compose.yml -f docker-compose.qa.yml -p ledgerlight-qa-test --profile tools config)"
prod_config="$(docker compose --env-file .env.prod.example -f docker-compose.yml -f docker-compose.prod.yml -p ledgerlight-prod-test --profile tools config)"
dev_seed_command="$(make -n dev-seed)"
qa_seed_command="$(make -n qa-seed)"

assert_contains "$dev_config" 'target: development' "dev backend should use the development Docker target"
assert_contains "$dev_config" 'published: "8080"' "dev backend should publish port 8080"
assert_contains "$dev_config" 'published: "5432"' "dev database should publish port 5432"
assert_contains "$dev_config" 'NODE_ENV: development' "dev backend should run in development mode"
assert_contains "$dev_config" 'npx prisma migrate dev' "dev migrate service should run prisma migrate dev"
assert_contains "$(cat .env.dev.example)" 'NEXT_PUBLIC_API_URL=http://localhost:8080' "dev env example should define the frontend API URL"

assert_contains "$qa_config" 'target: production' "qa backend should use the production Docker target"
assert_contains "$qa_config" 'published: "8081"' "qa backend should publish port 8081"
assert_contains "$qa_config" 'published: "5433"' "qa database should publish port 5433"
assert_contains "$qa_config" 'NODE_ENV: production' "qa backend should run in production mode"
assert_contains "$qa_config" 'backend-log-volume-init' "qa config should prepare backend log volume permissions before boot"
assert_contains "$qa_config" 'LOG_FILE_PATH: /var/log/ledgerlight/backend.ndjson' "qa backend should write structured logs to the shared ndjson file"
assert_contains "$qa_config" 'npx' "qa migrate service should be present"
assert_contains "$qa_config" 'migrate' "qa migrate service should use prisma migrate deploy"
assert_contains "$qa_config" 'deploy' "qa migrate service should use prisma migrate deploy"
assert_contains "$(cat .env.qa.example)" 'NEXT_PUBLIC_API_URL=http://localhost:8081' "qa env example should define the frontend API URL"

assert_contains "$prod_config" 'published: "8082"' "prod backend should publish port 8082"
assert_contains "$prod_config" 'target: production' "prod backend should use the production Docker target"
assert_contains "$prod_config" 'target: migrations' "prod migrate service should use the migrations Docker target"
assert_contains "$(cat .env.prod.example)" 'NEXT_PUBLIC_API_URL=https://your-production-domain.com' "prod env example should define the frontend API URL"

assert_contains "$dev_seed_command" 'prisma/seed.ts' "dev seed should target prisma/seed.ts"
assert_contains "$qa_seed_command" 'prisma/seed.demo.ts' "qa seed should target prisma/seed.demo.ts"

echo "environment config checks passed"
