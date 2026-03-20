#!/bin/bash

# Update Apache to listen on the dynamic Railway PORT
export PORT=${PORT:-8080}
sed -i "s/Listen 80/Listen ${PORT}/g" /etc/apache2/ports.conf
sed -i "s/:80/:${PORT}/g" /etc/apache2/sites-available/000-default.conf

# Clear caches so Laravel reads the newest environment variables injected by Railway
php artisan config:clear
php artisan route:clear
php artisan view:clear

# Start Apache in the foreground
echo "Starting Apache on port ${PORT}..."
exec apache2-foreground
