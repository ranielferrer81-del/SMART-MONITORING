FROM php:8.2-cli

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    unzip \
    libzip-dev \
    default-mysql-client \
    && docker-php-ext-install pdo pdo_mysql zip \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy project files
COPY . .

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Install PHP dependencies
RUN composer install --no-dev --optimize-autoloader

# Create storage directories with proper permissions
RUN mkdir -p storage/app/public/profile_pictures \
    storage/framework/cache/data \
    storage/framework/sessions \
    storage/framework/views \
    storage/logs \
    bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

# Make import script unix line endings and executable
RUN sed -i 's/\r$//' database/import.sh && chmod +x database/import.sh

# Create startup script that ALWAYS starts the server
RUN printf '#!/bin/bash\n\
\n\
echo "=== Cleaning environment variables ==="\n\
export DB_HOST=$(echo -n "$DB_HOST" | tr -d "\\r\\n ")\n\
export DB_PORT=$(echo -n "$DB_PORT" | tr -d "\\r\\n ")\n\
export DB_DATABASE=$(echo -n "$DB_DATABASE" | tr -d "\\r\\n ")\n\
export DB_USERNAME=$(echo -n "$DB_USERNAME" | tr -d "\\r\\n ")\n\
export DB_PASSWORD=$(echo -n "$DB_PASSWORD" | tr -d "\\r\\n ")\n\
\n\
# Ensure .env file exists (Laravel needs it even if empty)\n\
touch /app/.env\n\
\n\
# Generate APP_KEY if not provided\n\
if [ -z "$APP_KEY" ]; then\n\
  echo "APP_KEY not set, generating..."\n\
  php artisan key:generate --force 2>&1 || true\n\
fi\n\
\n\
# Clear config cache\n\
php artisan config:clear 2>&1 || true\n\
\n\
echo "=== Starting Laravel server ==="\n\
exec php artisan serve --host=0.0.0.0 --port=${PORT:-8000}\n\
' > /app/start.sh && chmod +x /app/start.sh

CMD ["/bin/bash", "/app/start.sh"]
