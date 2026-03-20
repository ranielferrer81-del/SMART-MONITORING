#!/bin/bash

echo "=========================================="
echo "=== Railway Laravel Startup ==="
echo "=========================================="
echo "PORT=${PORT:-8000}"
echo "PHP version: $(php -v | head -1)"

# Map Railway MySQL variables to Laravel DB_* variables
# Railway auto-provides: MYSQLHOST, MYSQLPORT, MYSQLDATABASE, MYSQLUSER, MYSQLPASSWORD
export DB_HOST="${DB_HOST:-$MYSQLHOST}"
export DB_PORT="${DB_PORT:-${MYSQLPORT:-3306}}"
export DB_DATABASE="${DB_DATABASE:-$MYSQLDATABASE}"
export DB_USERNAME="${DB_USERNAME:-$MYSQLUSER}"
export DB_PASSWORD="${DB_PASSWORD:-$MYSQLPASSWORD}"
export DB_CONNECTION="${DB_CONNECTION:-mysql}"
export CACHE_STORE="${CACHE_STORE:-file}"
export SESSION_DRIVER="${SESSION_DRIVER:-file}"
export APP_ENV="${APP_ENV:-production}"
export APP_DEBUG="${APP_DEBUG:-true}"
export APP_URL="${APP_URL:-https://smart-monitoring-production.up.railway.app}"
export APP_NAME="${APP_NAME:-SIA}"

# Strip whitespace/carriage returns from DB vars
DB_HOST=$(echo -n "$DB_HOST" | tr -d "\r\n ")
DB_PORT=$(echo -n "$DB_PORT" | tr -d "\r\n ")
DB_DATABASE=$(echo -n "$DB_DATABASE" | tr -d "\r\n ")
DB_USERNAME=$(echo -n "$DB_USERNAME" | tr -d "\r\n ")
DB_PASSWORD=$(echo -n "$DB_PASSWORD" | tr -d "\r\n ")

echo "DB_HOST=$DB_HOST"
echo "DB_PORT=$DB_PORT"
echo "DB_DATABASE=$DB_DATABASE"
echo "DB_USERNAME=$DB_USERNAME"
echo "DB_CONNECTION=$DB_CONNECTION"
echo "CACHE_STORE=$CACHE_STORE"
echo "SESSION_DRIVER=$SESSION_DRIVER"
echo "APP_ENV=$APP_ENV"
echo "APP_DEBUG=$APP_DEBUG"

# Write .env file - Laravel reads this on boot
# Using single-quoted heredoc delimiter to prevent shell expansion,
# then manually writing each variable
rm -f /app/.env

{
  echo "APP_NAME=$APP_NAME"
  echo "APP_ENV=$APP_ENV"
  echo "APP_KEY=$APP_KEY"
  echo "APP_DEBUG=$APP_DEBUG"
  echo "APP_URL=$APP_URL"
  echo ""
  echo "LOG_CHANNEL=${LOG_CHANNEL:-stack}"
  echo "LOG_LEVEL=debug"
  echo ""
  echo "DB_CONNECTION=$DB_CONNECTION"
  echo "DB_HOST=$DB_HOST"
  echo "DB_PORT=$DB_PORT"
  echo "DB_DATABASE=$DB_DATABASE"
  echo "DB_USERNAME=$DB_USERNAME"
  echo "DB_PASSWORD=$DB_PASSWORD"
  echo ""
  echo "SESSION_DRIVER=$SESSION_DRIVER"
  echo "SESSION_LIFETIME=120"
  echo "CACHE_STORE=$CACHE_STORE"
  echo ""
  echo "BROADCAST_CONNECTION=log"
  echo "FILESYSTEM_DISK=local"
  echo "QUEUE_CONNECTION=sync"
  echo ""
  echo "MAIL_MAILER=${MAIL_MAILER:-smtp}"
  echo "MAIL_HOST=${MAIL_HOST:-smtp.gmail.com}"
  echo "MAIL_PORT=${MAIL_PORT:-587}"
  echo "MAIL_USERNAME=${MAIL_USERNAME:-}"
  echo "MAIL_PASSWORD=${MAIL_PASSWORD:-}"
  echo "MAIL_ENCRYPTION=${MAIL_ENCRYPTION:-tls}"
  echo "MAIL_FROM_ADDRESS=${MAIL_FROM_ADDRESS:-}"
  echo "MAIL_FROM_NAME=${MAIL_FROM_NAME:-SIA}"
  echo ""
  echo "BREVO_API_KEY=${BREVO_API_KEY:-}"
} > /app/.env

echo "=== .env file written ==="
cat /app/.env | grep -v PASSWORD | grep -v KEY | grep -v MAIL_PASSWORD
echo "==========================="

# Generate APP_KEY if not set
if [ -z "$APP_KEY" ]; then
  echo "APP_KEY not set, generating..."
  php artisan key:generate --force 2>&1
fi

# Clear config and route caches
php artisan config:clear 2>&1
php artisan route:clear 2>&1
php artisan cache:clear 2>&1 || true

# Test database connection
echo "=== Testing database connection ==="
php -r "
try {
    \$pdo = new PDO('mysql:host=$DB_HOST;port=$DB_PORT;dbname=$DB_DATABASE', '$DB_USERNAME', '$DB_PASSWORD');
    echo 'Database connection: SUCCESS' . PHP_EOL;
} catch (Exception \$e) {
    echo 'Database connection: FAILED - ' . \$e->getMessage() . PHP_EOL;
}
" 2>&1

# Start the server
echo "=========================================="
echo "=== Starting Laravel on port ${PORT:-8000} ==="
echo "=========================================="
exec php artisan serve --host=0.0.0.0 --port=${PORT:-8000}
