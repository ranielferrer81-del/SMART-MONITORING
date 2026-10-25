@echo off
title SMART MONITORING - Database Setup
SET PHP=C:\Users\ranie\Downloads\php82\php.exe
SET MYSQL=C:\xampp\mysql\bin\mysql.exe
SET LARAVEL=C:\Users\ranie\Downloads\SMART-MONITORING-main\SMART-MONITORING-main\Backend-Laravel

echo ============================================
echo  SMART MONITORING - Database Setup
echo ============================================
echo.
echo [1/2] Creating database 'sia_app'...
"%MYSQL%" -u root -e "CREATE DATABASE IF NOT EXISTS sia_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
echo.
echo [2/2] Running migrations...
cd /d "%LARAVEL%"
"%PHP%" artisan migrate --force
echo.
echo ✅ Database setup complete!
pause
