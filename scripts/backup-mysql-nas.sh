#!/bin/sh
set -eu

CONTAINER_NAME="${MYSQL_CONTAINER:-coffee-mysql}"
BACKUP_DIR="${BACKUP_DIR:-/volume1/docker/mywebsite/backups/mysql}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
BACKUP_GROUP="${BACKUP_GROUP-administrators}"
DOCKER_BIN="${DOCKER_BIN:-/usr/local/bin/docker}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/coffee_order_${TIMESTAMP}.sql.gz"
TEMP_SQL="${BACKUP_DIR}/.coffee_order_${TIMESTAMP}.$$.sql"
TEMP_GZIP="${TEMP_SQL}.gz"

case "$BACKUP_DIR" in
  ""|/|*..*)
    echo "Unsafe BACKUP_DIR: $BACKUP_DIR" >&2
    exit 1
    ;;
esac

case "$RETENTION_DAYS" in
  *[!0-9]*|0)
    echo "RETENTION_DAYS must be a positive integer." >&2
    exit 1
    ;;
esac

umask 077
mkdir -p "$BACKUP_DIR"
if [ -n "$BACKUP_GROUP" ]; then
  chgrp "$BACKUP_GROUP" "$BACKUP_DIR"
  chmod 750 "$BACKUP_DIR"
else
  chmod 700 "$BACKUP_DIR"
fi

cleanup() {
  rm -f "$TEMP_SQL" "$TEMP_GZIP"
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM

"$DOCKER_BIN" exec "$CONTAINER_NAME" sh -c '
  MYSQL_PWD="$MYSQL_PASSWORD" exec mysqldump \
    --single-transaction --quick --skip-lock-tables \
    --routines --events --triggers --no-tablespaces \
    --set-gtid-purged=OFF --hex-blob \
    --default-character-set=utf8mb4 \
    -h 127.0.0.1 -P 3306 -u "$MYSQL_USER" "$MYSQL_DATABASE"
' > "$TEMP_SQL"

grep -q '^-- Dump completed on ' "$TEMP_SQL"
gzip -9 "$TEMP_SQL"
gzip -t "$TEMP_GZIP"
mv "$TEMP_GZIP" "$BACKUP_FILE"
if [ -n "$BACKUP_GROUP" ]; then
  chgrp "$BACKUP_GROUP" "$BACKUP_FILE"
  chmod 640 "$BACKUP_FILE"
else
  chmod 600 "$BACKUP_FILE"
fi

find "$BACKUP_DIR" -type f -name 'coffee_order_*.sql.gz' \
  -mtime "+$RETENTION_DAYS" -exec rm -f {} \;

BACKUP_SIZE=$(wc -c < "$BACKUP_FILE" | tr -d ' ')
printf 'MySQL backup completed: %s (%s bytes)\n' "$BACKUP_FILE" "$BACKUP_SIZE"
