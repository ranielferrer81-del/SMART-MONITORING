@echo off
title SMART MONITORING - Laravel Backend
SET PHP=C:\Users\ranie\Downloads\php82\php.exe
SET LARAVEL=C:\Users\ranie\Downloads\SMART-MONITORING-main\SMART-MONITORING-main\Backend-Laravel

echo ============================================
echo  SMART MONITORING - Laravel API Server
echo  Running on http://127.0.0.1:8000
echo ============================================
echo.

cd /d "%LARAVEL%"
"%PHP%" artisan config:clear
"%PHP%" -d upload_max_filesize=64M -d post_max_size=64M -d memory_limit=256M artisan serve --host=127.0.0.1 --port=8000
pause
