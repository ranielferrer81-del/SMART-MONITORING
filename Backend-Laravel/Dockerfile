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

# Remove any leaked local .env file so Railway variables are strictly used
RUN rm -f .env

# Copy our custom startup script that handles runtime variables
COPY docker-entrypoint.sh /usr/local/bin/
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Start the application using our script
CMD ["/usr/local/bin/docker-entrypoint.sh"]
