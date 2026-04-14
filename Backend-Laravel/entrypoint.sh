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

# Parse Railway DB URL when provided.
# IMPORTANT: Prefer MYSQL_PUBLIC_URL for cross-platform access (Render -> Railway).
# MYSQL_URL / MYSQLHOST often point to railway.internal and are unreachable outside Railway.
if [ -n "${MYSQL_PUBLIC_URL:-}" ]; then
    export DB_HOST=$(php -r '$u=parse_url(getenv("MYSQL_PUBLIC_URL")); echo $u["host"] ?? "";')
    export DB_PORT=$(php -r '$u=parse_url(getenv("MYSQL_PUBLIC_URL")); echo $u["port"] ?? "3306";')
    export DB_DATABASE=$(php -r '$u=parse_url(getenv("MYSQL_PUBLIC_URL")); echo isset($u["path"]) ? ltrim($u["path"], "/") : "";')
    export DB_USERNAME=$(php -r '$u=parse_url(getenv("MYSQL_PUBLIC_URL")); echo isset($u["user"]) ? rawurldecode($u["user"]) : "";')
    export DB_PASSWORD=$(php -r '$u=parse_url(getenv("MYSQL_PUBLIC_URL")); echo isset($u["pass"]) ? rawurldecode($u["pass"]) : "";')
elif [ -n "${MYSQL_URL:-}" ]; then
    export DB_HOST=$(php -r '$u=parse_url(getenv("MYSQL_URL")); echo $u["host"] ?? "";')
    export DB_PORT=$(php -r '$u=parse_url(getenv("MYSQL_URL")); echo $u["port"] ?? "3306";')
    export DB_DATABASE=$(php -r '$u=parse_url(getenv("MYSQL_URL")); echo isset($u["path"]) ? ltrim($u["path"], "/") : "";')
    export DB_USERNAME=$(php -r '$u=parse_url(getenv("MYSQL_URL")); echo isset($u["user"]) ? rawurldecode($u["user"]) : "";')
    export DB_PASSWORD=$(php -r '$u=parse_url(getenv("MYSQL_URL")); echo isset($u["pass"]) ? rawurldecode($u["pass"]) : "";')
fi

# ---------------------------------------------------------------
# 2. Safe defaults for drivers that might crash without tables
# ---------------------------------------------------------------
export CACHE_STORE="${CACHE_STORE:-file}"
export SESSION_DRIVER="${SESSION_DRIVER:-file}"
export APP_ENV="${APP_ENV:-production}"
export APP_DEBUG="${APP_DEBUG:-false}"
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
# 4. Write .env via PHP (bash heredocs break secrets with $, quotes, etc.)
# ---------------------------------------------------------------
echo "Writing .env via scripts/write-env.php..."
php scripts/write-env.php

echo "=== .env written ==="

# Railway Variables often include MAIL_MAILER=sendmail from Laravel defaults or old docs.
# Our container has no /usr/sbin/sendmail — that yields "sendmail: not found" and ~90s hangs.
# When Brevo is configured, force SMTP so Laravel + EmailService use smtp-relay, not sendmail.
if [ -n "${BREVO_API_KEY:-}" ]; then
  export MAIL_MAILER=smtp
  echo "MAIL_MAILER forced to smtp (BREVO_API_KEY is set; sendmail is not available in this image)."
fi

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
echo "BREVO_API_KEY = (${#BREVO_API_KEY} chars)  # must be set in Railway if using Brevo"
echo "MAIL_FROM_ADDRESS = ${MAIL_FROM_ADDRESS:-<unset, will use default>}"
echo "MAIL_MAILER (effective for PHP) = ${MAIL_MAILER:-<unset>}"
echo "MAIL_USERNAME (shell/Railway only; Laravel also reads .env) = (${#MAIL_USERNAME} chars)"
if [ -z "$BREVO_API_KEY" ]; then
  echo "WARNING: BREVO_API_KEY is empty — add it in Railway Variables for transactional email."
else
  if [ -z "${BREVO_SENDER_EMAIL:-}" ] && [ -z "${MAIL_FROM_ADDRESS:-}" ]; then
    echo "WARNING: Set BREVO_SENDER_EMAIL (or MAIL_FROM_ADDRESS) to an address verified in Brevo — API key alone will not deliver mail."
  fi
fi
case "${MAIL_FROM_ADDRESS:-}" in
  *example.com*|""|noreply@example.com)
    echo "WARNING: MAIL_FROM_ADDRESS should match a sender verified in Brevo (not noreply@example.com) or Brevo may reject sends."
    ;;
esac
case "${BREVO_SENDER_EMAIL:-}" in
  *example.com*|noreply@example.com)
    echo "WARNING: BREVO_SENDER_EMAIL must be a real verified sender in Brevo (not example.com)."
    ;;
esac
case "${MAIL_FROM_ADDRESS:-}" in
  *@gmail.com|*@googlemail.com|*@yahoo.*|*@hotmail.*|*@outlook.*|*@live.*)
    echo "NOTE: Freemail as From-address often hits Spam via Brevo. Fix: add your own domain in Brevo + DKIM/DMARC. Temporary unblock: AUTH_LOGIN_CODE_FALLBACK=true (returns code in API when send fails)."
    ;;
esac
echo "-------------------------------"

# ---------------------------------------------------------------
# 6. Laravel boot sequence
# ---------------------------------------------------------------
echo "Clearing stale caches..."
rm -f bootstrap/cache/config.php 2>/dev/null || true
php artisan config:clear 2>/dev/null || true
php artisan cache:clear 2>/dev/null || true
php artisan route:clear 2>/dev/null || true
php artisan view:clear 2>/dev/null || true

# ---------------------------------------------------------------
# 6b. Migrations (e.g. profile_picture LONGTEXT) — must not abort boot (set -e).
# Use `if ! cmd` so migrate failure logs a warning but php artisan serve still runs.
# ---------------------------------------------------------------
RUN_MIGRATIONS_ON_BOOT="${RUN_MIGRATIONS_ON_BOOT:-false}"
if [ "$RUN_MIGRATIONS_ON_BOOT" = "true" ]; then
    echo "Running database migrations..."
    if ! php artisan migrate --force --no-interaction; then
        echo "WARNING: php artisan migrate failed — check DB/logs. API will still start; run migrate manually if needed."
    fi
else
    echo "Skipping automatic migrations on boot (RUN_MIGRATIONS_ON_BOOT=false)."
fi

# Optional one-time bootstrap admin creation for fresh production databases.
# Set BOOTSTRAP_ADMIN_EMAIL + BOOTSTRAP_ADMIN_PASSWORD in Render env vars.
if [ -n "${BOOTSTRAP_ADMIN_EMAIL:-}" ] && [ -n "${BOOTSTRAP_ADMIN_PASSWORD:-}" ]; then
    echo "Ensuring bootstrap admin account exists..."
    if ! php artisan db:seed --class=Database\\Seeders\\BootstrapAdminSeeder --force --no-interaction; then
        echo "WARNING: BootstrapAdminSeeder failed. Check DB connectivity and users table schema."
    fi
else
    echo "Skipping bootstrap admin seeding (BOOTSTRAP_ADMIN_EMAIL/PASSWORD not set)."
fi

echo "Optimizing for production..."
# Do NOT run config:cache here: it bakes env at boot time and breaks mail keys / MAIL_FROM
# if they change in Railway without a full redeploy. Route cache is safe.
php artisan route:cache 2>/dev/null || true

# ---------------------------------------------------------------
# 7. Test database connection before starting the server
# ---------------------------------------------------------------
BOOT_DB_CHECK="${BOOT_DB_CHECK:-false}"
if [ "$BOOT_DB_CHECK" = "true" ]; then
    echo "Testing database connection..."
    php artisan tinker --execute="try { DB::connection()->getPdo(); echo 'DB OK: connected to ' . DB::connection()->getDatabaseName(); } catch(Exception \$e) { echo 'DB WARN: ' . \$e->getMessage(); }" 2>/dev/null || echo "DB test skipped (tinker not available)"
else
    echo "Skipping boot DB check (BOOT_DB_CHECK=false)."
fi

# ---------------------------------------------------------------
# 8. Start the server
# ---------------------------------------------------------------
echo "Starting Laravel server on port ${PORT:-8080}..."
exec php artisan serve --host=0.0.0.0 --port=${PORT:-8080}
