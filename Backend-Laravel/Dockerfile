FROM php:8.2-apache

# Install dependencies required by Laravel and Composer
RUN apt-get update && apt-get install -y \
    git \
    unzip \
    libzip-dev \
    libonig-dev \
    && docker-php-ext-install pdo pdo_mysql zip mbstring \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Enable Apache mod_rewrite for Laravel routing
RUN a2enmod rewrite

# Change Apache document root to Laravel's public folder
ENV APACHE_DOCUMENT_ROOT /var/www/html/public
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf
RUN sed -ri -e 's!/var/www/!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/apache2.conf /etc/apache2/conf-available/*.conf

# Set working directory
WORKDIR /var/www/html

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Copy composer files and install dependencies
# We use --no-scripts here to prevent package:discover from running without the full app
COPY composer.json composer.lock ./
RUN composer install --no-dev --optimize-autoloader --no-scripts || true

# Copy the rest of the application
COPY . .

# Run composer again to trigger package discovery now that the source code is present
RUN composer install --no-dev --optimize-autoloader

# Create required storage directories and set permissions
RUN mkdir -p storage/framework/cache/data \
    storage/framework/sessions \
    storage/framework/views \
    bootstrap/cache

# Allow Apache to write to Laravel caches
RUN chown -R www-data:www-data storage bootstrap/cache
RUN chmod -R 777 storage bootstrap/cache

# Remove any leaked local configuration files
RUN rm -f .env docker-entrypoint.sh start.sh Procfile || true

# We embed the startup commands entirely inside the CMD string. 
# This completely bypasses any missing files or formatting issues (like invisible Windows line-endings).
# It dynamically assigns Apache to listen on Railway's $PORT, clears caches, and starts the server.
CMD sh -c "sed -i \"s/Listen 80/Listen ${PORT:-8080}/g\" /etc/apache2/ports.conf && sed -i \"s/:80/:${PORT:-8080}/g\" /etc/apache2/sites-available/000-default.conf && php artisan config:clear && apache2-foreground"
