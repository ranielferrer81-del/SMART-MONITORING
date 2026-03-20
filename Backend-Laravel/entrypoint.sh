#!/bin/bash
set -e

echo "=== SMART-MONITORING Backend Starting ==="
echo "Time: $(date)"

# ---------------------------------------------------------------
# 1. Map Railway-injected MySQL variables to Laravel's DB_* names
#    Railway's MySQL plugin exposes: MYSQLHOST, MYSQLPORT,
#    MYSQLUSER, MYSQLPASSWORD, MYSQLDATABASE, MYSQL_URL
#    Laravel expects: DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD,
#    DB_DATABASE
# ---------------------------------------------------------------
export DB_CONNECTION="${DB_CONNECTION:-mysql}"
export DB_HOST="${DB_HOST:-${MYSQLHOST:-127.0.0.1}}"
export DB_PORT="${DB_PORT:-${MYSQLPORT:-3306}}"
export DB_DATABASE="${DB_DATABASE:-${MYSQLDATABASE:-railway}}"
export DB_USERNAME="${DB_USERNAME:-${MYSQLUSER:-root}}"
export DB_PASSWORD="${DB_PASSWORD:-${MYSQLPASSWORD:-${MYSQL_ROOT_PASSWORD:-}}}"

# Always parse MYSQL_URL if it is provided by Railway, as it perfectly contains the password
if [ -n "$MYSQL_URL" ]; then
    # MYSQL_URL format: mysql://user:pass@host:port/database
    export DB_HOST=$(echo "$MYSQL_URL" | sed -E 's|.*@([^:]+):.*|\1|')
    export DB_PORT=$(echo "$MYSQL_URL" | sed -E 's|.*:([0-9]+)/.*|\1|')
    export DB_DATABASE=$(echo "$MYSQL_URL" | sed -E 's|.*/([^?]+).*|\1|')
    export DB_USERNAME=$(echo "$MYSQL_URL" | sed -E 's|mysql://([^:]+):.*|\1|')
    export DB_PASSWORD=$(echo "$MYSQL_URL" | sed -E 's|mysql://[^:]+:([^@]+)@.*|\1|')
fi

# ---------------------------------------------------------------
# 2. Safe defaults for drivers that might crash without tables
# ---------------------------------------------------------------
export CACHE_STORE="${CACHE_STORE:-file}"
export SESSION_DRIVER="${SESSION_DRIVER:-file}"
export APP_ENV="${APP_ENV:-production}"
export APP_DEBUG="${APP_DEBUG:-true}"
export APP_URL="${APP_URL:-https://smart-monitoring-production.up.railway.app}"

# ---------------------------------------------------------------
# 3. Generate APP_KEY if not set
# ---------------------------------------------------------------
if [ -z "$APP_KEY" ]; then
    echo "WARNING: APP_KEY not set. Generating one now..."
    export APP_KEY=$(php artisan key:generate --show 2>/dev/null || echo "base64:$(openssl rand -base64 32)")
    echo "Generated APP_KEY (set this in Railway Variables to persist): $APP_KEY"
fi

# ---------------------------------------------------------------
# 4. Write all environment variables to .env
#    Laravel reads .env at boot; without it, env() returns nulls
# ---------------------------------------------------------------
echo "Writing .env file from environment variables..."
cat > /app/.env << ENVFILE
APP_NAME=${APP_NAME:-SIA}
APP_ENV=${APP_ENV}
APP_KEY=${APP_KEY}
APP_DEBUG=${APP_DEBUG}
APP_URL=${APP_URL}

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

QUEUE_CONNECTION=sync
FILESYSTEM_DISK=local

MAIL_MAILER=${MAIL_MAILER:-smtp}
MAIL_HOST=${MAIL_HOST:-smtp.gmail.com}
MAIL_PORT=${MAIL_PORT:-587}
MAIL_USERNAME=${MAIL_USERNAME:-}
MAIL_PASSWORD=${MAIL_PASSWORD:-}
MAIL_ENCRYPTION=${MAIL_ENCRYPTION:-tls}
MAIL_FROM_ADDRESS="${MAIL_FROM_ADDRESS:-noreply@example.com}"
MAIL_FROM_NAME="${MAIL_FROM_NAME:-SIA}"

BREVO_API_KEY=${BREVO_API_KEY:-}
ENVFILE

echo "=== .env written ==="

# ---------------------------------------------------------------
# 5. Diagnostic output (visible in Railway deploy logs)
# ---------------------------------------------------------------
echo "--- Environment Diagnostics ---"
echo "DB_HOST     = $DB_HOST"
echo "DB_PORT     = $DB_PORT"
echo "DB_DATABASE = $DB_DATABASE"
echo "DB_USERNAME = $DB_USERNAME"
echo "DB_PASSWORD = (${#DB_PASSWORD} chars)"
echo "CACHE_STORE = $CACHE_STORE"
echo "SESSION_DRIVER = $SESSION_DRIVER"
echo "APP_KEY     = ${APP_KEY:0:10}..."
echo "PORT        = ${PORT:-8080}"
echo "-------------------------------"

# ---------------------------------------------------------------
# 6. Laravel boot sequence
# ---------------------------------------------------------------
echo "Clearing stale caches..."
php artisan config:clear 2>/dev/null || true
php artisan cache:clear 2>/dev/null || true
php artisan route:clear 2>/dev/null || true
php artisan view:clear 2>/dev/null || true

echo "Optimizing for production..."
php artisan config:cache 2>/dev/null || true
php artisan route:cache 2>/dev/null || true

# ---------------------------------------------------------------
# 7. Configure Apache to listen on Railway's injected $PORT
# ---------------------------------------------------------------
echo "Configuring Apache to listen on port ${PORT:-80}..."
sed -i "s/80/${PORT:-80}/g" /etc/apache2/sites-available/000-default.conf /etc/apache2/ports.conf

echo "Starting Apache production server..."
exec apache2-foreground
