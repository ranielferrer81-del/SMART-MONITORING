FROM php:8.2-cli

# Install dependencies required by Laravel and Composer
RUN apt-get update && apt-get install -y \
    git \
    unzip \
    libzip-dev \
    libonig-dev \
    && docker-php-ext-install pdo pdo_mysql zip mbstring \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Copy composer files and install dependencies
# We use --no-scripts here to prevent package:discover from running without the full app
COPY composer.json composer.lock ./
RUN composer install --no-dev --optimize-autoloader --no-scripts

# Copy the rest of the application
COPY . .

# Run composer again to trigger package discovery now that the source code is present
RUN composer install --no-dev --optimize-autoloader

# Create required storage directories and set permissions
RUN mkdir -p storage/framework/cache/data \
    storage/framework/sessions \
    storage/framework/views \
    bootstrap/cache \
    && chmod -R 777 storage bootstrap/cache

# Remove any leaked local .env file so Railway variables are strictly used
RUN rm -f .env

# Expose the Railway port
EXPOSE ${PORT:-8080}

# Start the Laravel application directly
# By using sh -c it properly evaluates $PORT dynamically at start time
CMD sh -c "php artisan config:clear && php artisan route:clear && php artisan serve --host=0.0.0.0 --port=${PORT:-8080}"
