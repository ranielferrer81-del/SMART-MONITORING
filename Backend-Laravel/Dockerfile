FROM php:8.2-cli

RUN apt-get update && apt-get install -y libzip-dev zip unzip git libonig-dev \
    && docker-php-ext-install pdo pdo_mysql zip mbstring \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Copy composer files
COPY composer.json composer.lock ./

# Install dependencies (no scripts to prevent discovery errors)
RUN composer install --no-dev --optimize-autoloader --no-scripts || true

# Copy all source files
COPY . .

# Complete composer installation safely
RUN composer install --no-dev --optimize-autoloader

# Ensure Laravel storage directories exist and are writable
RUN mkdir -p storage/framework/cache/data \
    storage/framework/sessions \
    storage/framework/views \
    bootstrap/cache \
    && chmod -R 777 storage bootstrap/cache

# Remove any residual env/scripts that disrupt Railway variables
RUN rm -f .env docker-entrypoint.sh start.sh Procfile package.json package-lock.json vite.config.js || true

# Explicit port exposure
EXPOSE 8080

# We completely bypass `php artisan serve` which contains a known bug dropping CORS OPTIONS preflights 
# and causing 502 Bad Gateway responses on Railway proxies. 
# Instead, we use the pure native PHP server directed entirely at the public folder.
CMD sh -c "php artisan config:clear && php -S 0.0.0.0:${PORT:-8080} -t public"
