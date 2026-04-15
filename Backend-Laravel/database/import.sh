#!/bin/bash
set -e

echo "=== Database Import Script ==="

# Railway provides these env vars for MySQL
# MYSQLHOST, MYSQLPORT, MYSQLUSER, MYSQLPASSWORD, MYSQLDATABASE
# OR DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE

HOST="${MYSQLHOST:-$DB_HOST}"
PORT="${MYSQLPORT:-$DB_PORT}"
USER="${MYSQLUSER:-$DB_USERNAME}"
PASS="${MYSQLPASSWORD:-$DB_PASSWORD}"
DBNAME="${MYSQLDATABASE:-$DB_DATABASE}"

if [ -z "$HOST" ] || [ -z "$USER" ] || [ -z "$DBNAME" ]; then
  echo "ERROR: Database connection variables not set!"
  echo "Need MYSQLHOST/DB_HOST, MYSQLUSER/DB_USERNAME, MYSQLDATABASE/DB_DATABASE"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_FILE="${SCRIPT_DIR}/legacy_seed.sql"

if [ ! -f "$SQL_FILE" ]; then
  echo "ERROR: SQL file not found at $SQL_FILE"
  exit 1
fi

echo "Connecting to $HOST:$PORT as $USER, database: $DBNAME"

# Create a cleaned version of the SQL file
echo "Cleaning SQL file..."
CLEAN_FILE="/tmp/clean_seed.sql"

sed \
  -e 's/DEFINER=`[^`]*`@`[^`]*`//g' \
  -e 's/SQL SECURITY DEFINER//g' \
  -e 's/ALGORITHM=UNDEFINED//g' \
  "$SQL_FILE" > "$CLEAN_FILE"

echo "Importing database..."
mysql -h "$HOST" -P "$PORT" -u "$USER" -p"$PASS" --skip-ssl "$DBNAME" < "$CLEAN_FILE"

echo "=== Import completed successfully! ==="
