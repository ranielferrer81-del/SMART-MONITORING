FROM php:8.2-cli

# Install dependencies needed by Laravel
RUN apt-get update && apt-get install -y \
    libzip-dev \
    zip \
    unzip \
    git \
    libonig-dev \
    && docker-php-ext-install pdo pdo_mysql zip mbstring \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Copy composer files
COPY composer.json composer.lock ./

# Install dependencies
RUN composer install --no-dev --optimize-autoloader --no-scripts || true

# Copy application files
COPY . .

# Finish composer installation
RUN composer install --no-dev --optimize-autoloader

# Create storage locations and give permissions
RUN mkdir -p storage/framework/cache/data \
    storage/framework/sessions \
    storage/framework/views \
    bootstrap/cache \
    && chmod -R 777 storage bootstrap/cache

# Remove any configuration file that could overwrite environment variables
RUN rm -f .env docker-entrypoint.sh start.sh Procfile || true

# Expose Railway's dynamic port
EXPOSE 8080

# We use the built-in php artisan serve command because Apache is causing MPM collision errors.
# The CMD evaluates ${PORT} properly and binds globally to 0.0.0.0.
CMD sh -c "php artisan config:clear && php artisan serve --host=0.0.0.0 --port=${PORT:-8080}"
