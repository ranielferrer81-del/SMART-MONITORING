FROM php:8.2-cli

# Install system dependencies and dos2unix
RUN apt-get update && apt-get install -y \
    bash \
    git \
    unzip \
    libzip-dev \
    default-mysql-client \
    openssl \
    ca-certificates \
    dos2unix \
    poppler-utils \
    && docker-php-ext-install pdo pdo_mysql zip \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Configure PHP upload and memory limits (allow up to 64MB lesson modules)
RUN echo "upload_max_filesize = 64M" > /usr/local/etc/php/conf.d/uploads.ini \
    && echo "post_max_size = 64M" >> /usr/local/etc/php/conf.d/uploads.ini \
    && echo "memory_limit = 256M" >> /usr/local/etc/php/conf.d/uploads.ini

WORKDIR /var/www/html
COPY . .

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Install PHP dependencies
RUN composer install --no-dev --optimize-autoloader

# Storage permissions
RUN mkdir -p storage/app/public/profile_pictures \
    storage/framework/cache/data \
    storage/framework/sessions \
    storage/framework/views \
    storage/logs \
    bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

# Expose port explicitly for Railway's proxy router
EXPOSE 8080

# Clean scripts
RUN dos2unix entrypoint.sh database/import.sh || true
RUN chmod +x database/import.sh entrypoint.sh

CMD ["/var/www/html/entrypoint.sh"]
