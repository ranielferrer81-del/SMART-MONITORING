#!/bin/bash

echo "=== Railway Laravel Startup ==="
echo "PORT=${PORT:-8000}"

# ---------------------------------------------------------------
# 1. Map Railway-provided MySQL variables to Laravel DB_* variables
#    Railway sets: MYSQLHOST, MYSQLPORT, MYSQLDATABASE, MYSQLUSER,
#    MYSQLPASSWORD, MYSQL_URL  (automatically when MySQL is linked)
#    Laravel expects: DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD
# ---------------------------------------------------------------
export DB_HOST="${DB_HOST:-$MYSQLHOST}"
export DB_PORT="${DB_PORT:-${MYSQLPORT:-3306}}"
export DB_DATABASE="${DB_DATABASE:-$MYSQLDATABASE}"
export DB_USERNAME="${DB_USERNAME:-$MYSQLUSER}"
export DB_PASSWORD="${DB_PASSWORD:-$MYSQLPASSWORD}"
export DB_CONNECTION="${DB_CONNECTION:-mysql}"

# Strip whitespace / carriage returns from DB vars
export DB_HOST=$(echo -n "$DB_HOST" | tr -d "\r\n ")
export DB_PORT=$(echo -n "$DB_PORT" | tr -d "\r\n ")
export DB_DATABASE=$(echo -n "$DB_DATABASE" | tr -d "\r\n ")
export DB_USERNAME=$(echo -n "$DB_USERNAME" | tr -d "\r\n ")
export DB_PASSWORD=$(echo -n "$DB_PASSWORD" | tr -d "\r\n ")

# Use file-based cache and sessions (no database table needed)
export CACHE_STORE="${CACHE_STORE:-file}"
export SESSION_DRIVER="${SESSION_DRIVER:-file}"

# Production defaults
export APP_ENV="${APP_ENV:-production}"
export APP_DEBUG="${APP_DEBUG:-true}"

echo "DB_HOST=$DB_HOST"
echo "DB_PORT=$DB_PORT"
echo "DB_DATABASE=$DB_DATABASE"
echo "DB_USERNAME=$DB_USERNAME"
echo "DB_CONNECTION=$DB_CONNECTION"
echo "CACHE_STORE=$CACHE_STORE"
echo "SESSION_DRIVER=$SESSION_DRIVER"

# ---------------------------------------------------------------
# 2. Write a .env file so Laravel's env() calls can read everything
#    Railway injects env vars into the container, but Laravel also
#    reads from .env on boot. We write them all to be safe.
# ---------------------------------------------------------------
cat > /app/.env << ENVEOF
APP_NAME=${APP_NAME:-SIA}
APP_ENV=${APP_ENV}
APP_KEY=${APP_KEY:-}
APP_DEBUG=${APP_DEBUG}
APP_URL=${APP_URL:-https://smart-monitoring-production.up.railway.app}

LOG_CHANNEL=stack
LOG_LEVEL=debug

DB_CONNECTION=${DB_CONNECTION}
DB_HOST=${DB_HOST}
DB_PORT=${DB_PORT}
DB_DATABASE=${DB_DATABASE}
DB_USERNAME=${DB_USERNAME}
DB_PASSWORD=${DB_PASSWORD}

SESSION_DRIVER=${SESSION_DRIVER}
SESSION_LIFETIME=120
CACHE_STORE=${CACHE_STORE}

BROADCAST_CONNECTION=log
FILESYSTEM_DISK=local
QUEUE_CONNECTION=sync

MAIL_MAILER=${MAIL_MAILER:-smtp}
MAIL_HOST=${MAIL_HOST:-smtp.gmail.com}
MAIL_PORT=${MAIL_PORT:-587}
MAIL_USERNAME=${MAIL_USERNAME:-}
MAIL_PASSWORD=${MAIL_PASSWORD:-}
MAIL_ENCRYPTION=${MAIL_ENCRYPTION:-tls}
MAIL_FROM_ADDRESS="${MAIL_FROM_ADDRESS:-}"
MAIL_FROM_NAME="${MAIL_FROM_NAME:-SIA}"

BREVO_API_KEY=${BREVO_API_KEY:-}
ENVEOF

echo "=== .env file written ==="

# ---------------------------------------------------------------
# 3. Generate APP_KEY if not already set
# ---------------------------------------------------------------
if [ -z "$APP_KEY" ]; then
  echo "APP_KEY not set, generating..."
  php artisan key:generate --force 2>&1 || echo "WARNING: key:generate failed"
fi

# ---------------------------------------------------------------
# 4. Clear any cached config (important after writing new .env)
# ---------------------------------------------------------------
php artisan config:clear 2>&1 || echo "WARNING: config:clear failed"

# ---------------------------------------------------------------
# 5. Start the server
# ---------------------------------------------------------------
echo "=== Starting Laravel server on port ${PORT:-8000} ==="
exec php artisan serve --host=0.0.0.0 --port=${PORT:-8000}
