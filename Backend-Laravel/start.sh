#!/bin/bash

echo "=== Cleaning environment variables ==="
export DB_HOST=$(echo -n "$DB_HOST" | tr -d "\r\n ")
export DB_PORT=$(echo -n "$DB_PORT" | tr -d "\r\n ")
export DB_DATABASE=$(echo -n "$DB_DATABASE" | tr -d "\r\n ")
export DB_USERNAME=$(echo -n "$DB_USERNAME" | tr -d "\r\n ")
export DB_PASSWORD=$(echo -n "$DB_PASSWORD" | tr -d "\r\n ")

# Ensure .env file exists
touch /app/.env

# Generate APP_KEY if not provided
if [ -z "$APP_KEY" ]; then
  echo "APP_KEY not set, generating..."
  php artisan key:generate --force 2>&1 || true
fi

# Clear config cache
php artisan config:clear 2>&1 || true

echo "=== Starting Laravel server ==="
exec php artisan serve --host=0.0.0.0 --port=${PORT:-8000}
