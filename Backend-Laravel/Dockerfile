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

# NOTE: No storage:link needed - StorageController in web.php serves files via /storage/* route

# Make scripts executable
RUN chmod +x database/import.sh entrypoint.sh

# Start the application via entrypoint (maps Railway env vars → .env → Laravel)
CMD ["/app/entrypoint.sh"]
