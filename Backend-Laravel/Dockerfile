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

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Copy composer files first for better caching
COPY composer.json composer.lock ./

# Install PHP dependencies
RUN composer install --no-dev --optimize-autoloader --no-scripts

# Copy project files
COPY . .

# Re-run composer to trigger post-install scripts (package:discover etc)
RUN composer install --no-dev --optimize-autoloader

# Create storage directories with proper permissions
RUN mkdir -p storage/app/public/profile_pictures \
    storage/framework/cache/data \
    storage/framework/sessions \
    storage/framework/views \
    storage/logs \
    bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

# Fix line endings for shell scripts
RUN sed -i 's/\r$//' database/import.sh 2>/dev/null || true && chmod +x database/import.sh 2>/dev/null || true

# Copy and fix start script
COPY start.sh /app/start.sh
RUN sed -i 's/\r$//' /app/start.sh && chmod +x /app/start.sh

# Remove any local .env that might have leaked in
RUN rm -f /app/.env

EXPOSE ${PORT:-8000}

CMD ["/bin/bash", "/app/start.sh"]
