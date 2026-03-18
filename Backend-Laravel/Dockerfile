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

# Make import script executable
RUN chmod +x database/import.sh

# Create startup script
RUN echo '#!/bin/bash\n\
set -e\n\
\n\
# Check if database has been seeded (users table exists)\n\
TABLE_CHECK=$(mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USERNAME" -p"$DB_PASSWORD" "$DB_DATABASE" -e "SHOW TABLES LIKE '"'"'users'"'"';" 2>/dev/null | grep -c users || true)\n\
\n\
if [ "$TABLE_CHECK" = "0" ]; then\n\
  echo "=== First run: importing database schema and seed data ==="\n\
  bash /app/database/import.sh\n\
else\n\
  echo "=== Database already seeded, skipping import ==="\n\
fi\n\
\n\
# Generate app key if not set\n\
php artisan config:clear\n\
\n\
echo "=== Starting Laravel server ==="\n\
exec php artisan serve --host=0.0.0.0 --port=${PORT:-8000}\n\
' > /app/start.sh && chmod +x /app/start.sh

CMD ["/bin/bash", "/app/start.sh"]
