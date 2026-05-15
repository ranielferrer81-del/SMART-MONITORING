#!/bin/bash
set -e

echo "=== Database Import Script (legacy_seed.sql) ==="

# Prefer DB_* (entrypoint maps MYSQL_PUBLIC_URL / MYSQL_URL into these).
HOST="${DB_HOST:-${MYSQLHOST:-}}"
PORT="${DB_PORT:-${MYSQLPORT:-3306}}"
USER="${DB_USERNAME:-${MYSQLUSER:-}}"
PASS="${DB_PASSWORD:-${MYSQLPASSWORD:-}}"
DBNAME="${DB_DATABASE:-${MYSQLDATABASE:-}}"

if [ -z "$HOST" ] || [ -z "$USER" ] || [ -z "$DBNAME" ]; then
  echo "ERROR: Database connection variables not set!"
  echo "Need DB_HOST or MYSQLHOST, DB_USERNAME or MYSQLUSER, DB_DATABASE or MYSQLDATABASE"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_FILE="${SCRIPT_DIR}/legacy_seed.sql"

if [ ! -f "$SQL_FILE" ]; then
  echo "ERROR: SQL file not found at $SQL_FILE"
  exit 1
fi

echo "Connecting to $HOST:$PORT as $USER, database: $DBNAME"

echo "Cleaning SQL file (strip DEFINER / SQL SECURITY for hosted MySQL)..."
CLEAN_FILE="/tmp/clean_seed.sql"

sed \
  -e 's/DEFINER=`[^`]*`@`[^`]*`//g' \
  -e 's/SQL SECURITY DEFINER//g' \
  -e 's/ALGORITHM=UNDEFINED//g' \
  "$SQL_FILE" > "$CLEAN_FILE"

# Avoid -p on the command line (special characters in Railway passwords).
CFG="$(mktemp)"
chmod 600 "$CFG"
{
  echo '[client]'
  echo "host=${HOST}"
  echo "port=${PORT}"
  echo "user=${USER}"
  echo "password=${PASS}"
  echo "database=${DBNAME}"
} > "$CFG"

MYSQL_EXTRA=(--defaults-extra-file="$CFG" --default-character-set=utf8mb4)
# Hosted MySQL without TLS on private network; use MYSQL_IMPORT_REQUIRE_SSL=true if your host requires TLS.
if [ "${MYSQL_IMPORT_REQUIRE_SSL:-}" = "true" ]; then
  MYSQL_EXTRA+=(--ssl-mode=REQUIRED)
else
  MYSQL_EXTRA+=(--skip-ssl)
fi

echo "Importing database..."
mysql "${MYSQL_EXTRA[@]}" < "$CLEAN_FILE"

rm -f "$CFG" "$CLEAN_FILE"

echo "=== Import completed successfully! ==="
