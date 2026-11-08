#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-$PWD/docker-compose.yml}"
APP_HEALTH_URL="${APP_HEALTH_URL:-http://host.docker.internal:8888/actuator/health}"
APP_SMOKE_URL="${APP_SMOKE_URL:-http://host.docker.internal:8888/api/departments}"
OCR_HEALTH_URL="${OCR_HEALTH_URL:-http://host.docker.internal:8090/health}"
MYSQL_DATABASE="${MYSQL_DATABASE:-coffee_order}"
MYSQL_USER="${MYSQL_USER:-coffee}"
APP_DATA_DIR="${APP_DATA_DIR:-/volume1/docker/mywebsite/data}"

required_variables=(
  APP_IMAGE OCR_IMAGE MYSQL_DATABASE MYSQL_USER MYSQL_PASSWORD MYSQL_ROOT_PASSWORD
  TWOSOME_ADMIN_ID TWOSOME_ADMIN_PW TWOSOME_CRYPTO_KEY ADMIN_PASSWORD
)
for name in "${required_variables[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "Required environment variable is missing: $name" >&2
    exit 1
  fi
done
export APP_IMAGE OCR_IMAGE MYSQL_DATABASE MYSQL_USER APP_DATA_DIR

for command in docker curl; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "Required command is unavailable: $command" >&2
    exit 1
  }
done

[[ -f "$COMPOSE_FILE" ]] || {
  echo "Compose file not found: $COMPOSE_FILE" >&2
  exit 1
}
docker image inspect "$APP_IMAGE" >/dev/null
docker image inspect "$OCR_IMAGE" >/dev/null
docker inspect coffee-order coffee-mysql coffee-redis >/dev/null

PREVIOUS_APP_IMAGE="$(docker inspect --format '{{.Config.Image}}' coffee-order)"
PREVIOUS_OCR_IMAGE="$(docker inspect --format '{{.Config.Image}}' coffee-ocr 2>/dev/null || true)"
MYSQL_ID_BEFORE="$(docker inspect --format '{{.Id}}' coffee-mysql)"
REDIS_ID_BEFORE="$(docker inspect --format '{{.Id}}' coffee-redis)"
MYSQL_STORAGE_BEFORE="$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/var/lib/mysql"}}{{.Source}}{{end}}{{end}}' coffee-mysql)"
REDIS_STORAGE_BEFORE="$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Source}}{{end}}{{end}}' coffee-redis)"

if [[ -z "$MYSQL_STORAGE_BEFORE" || -z "$REDIS_STORAGE_BEFORE" ]]; then
  echo 'Could not identify existing MySQL or Redis storage. Deployment stopped.' >&2
  exit 1
fi

PROJECT_NAME="${COMPOSE_PROJECT_NAME:-}"
if [[ -z "$PROJECT_NAME" ]]; then
  PROJECT_NAME="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' coffee-mysql)"
fi
if [[ ! "$PROJECT_NAME" =~ ^[a-zA-Z0-9_-]+$ ]]; then
  echo 'Could not identify the existing Compose project. Set COMPOSE_PROJECT_NAME explicitly.' >&2
  exit 1
fi

compose() {
  docker compose --project-name "$PROJECT_NAME" --file "$COMPOSE_FILE" "$@"
}

wait_for_url() {
  local url="$1"
  local expected="$2"
  local attempts="${3:-30}"
  local response
  for ((attempt = 1; attempt <= attempts; attempt++)); do
    if response="$(curl --fail --silent --show-error --max-time 5 "$url" 2>/dev/null)" \
      && [[ "$response" == *"$expected"* ]]; then
      return 0
    fi
    sleep 5
  done
  return 1
}

rollback() {
  echo "Rolling back the app image to $PREVIOUS_APP_IMAGE" >&2
  if [[ -n "$PREVIOUS_OCR_IMAGE" ]]; then
    APP_IMAGE="$PREVIOUS_APP_IMAGE" OCR_IMAGE="$PREVIOUS_OCR_IMAGE" \
      compose up -d --no-deps app ocr
  else
    APP_IMAGE="$PREVIOUS_APP_IMAGE" compose up -d --no-deps app
  fi
  wait_for_url "$APP_HEALTH_URL" '"status":"UP"' 12 || true
}

printf 'Compose project: %s\n' "$PROJECT_NAME"
printf 'App image: %s\nOCR image: %s\n' "$APP_IMAGE" "$OCR_IMAGE"
compose config --quiet

if ! compose up -d --no-deps app ocr; then
  rollback
  exit 1
fi

if [[ "$(docker inspect --format '{{.Id}}' coffee-mysql)" != "$MYSQL_ID_BEFORE" \
  || "$(docker inspect --format '{{.Id}}' coffee-redis)" != "$REDIS_ID_BEFORE" \
  || "$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/var/lib/mysql"}}{{.Source}}{{end}}{{end}}' coffee-mysql)" != "$MYSQL_STORAGE_BEFORE" \
  || "$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Source}}{{end}}{{end}}' coffee-redis)" != "$REDIS_STORAGE_BEFORE" ]]; then
  echo 'MySQL or Redis changed unexpectedly. Inspect the containers before continuing.' >&2
  rollback
  exit 1
fi

if ! wait_for_url "$OCR_HEALTH_URL" 'ok' 24; then
  echo 'OCR health check failed.' >&2
  docker logs --tail 100 coffee-ocr >&2 || true
  rollback
  exit 1
fi

if ! wait_for_url "$APP_HEALTH_URL" '"status":"UP"' 36; then
  echo 'Application health check failed.' >&2
  docker logs --tail 100 coffee-order >&2 || true
  rollback
  exit 1
fi

if ! wait_for_url "$APP_SMOKE_URL" '[' 6; then
  echo 'Department API smoke check failed.' >&2
  docker logs --tail 100 coffee-order >&2 || true
  rollback
  exit 1
fi

printf 'Deployment verified. MySQL and Redis containers were preserved.\n'
docker ps --filter 'name=^/coffee-order$' --filter 'name=^/coffee-mysql$' \
  --filter 'name=^/coffee-redis$' --filter 'name=^/coffee-ocr$' \
  --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
