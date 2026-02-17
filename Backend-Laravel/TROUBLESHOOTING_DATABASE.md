# Database Connection Troubleshooting Guide

## Error: "No connection could be made because the target machine actively refused it"

This error means Laravel cannot connect to MySQL. Follow these steps:

## Step 1: Check if MySQL is Running

### For XAMPP:
1. Open XAMPP Control Panel
2. Check if MySQL service is running (should show "Running" in green)
3. If not running, click "Start" next to MySQL

### For MySQL installed separately:
1. Open Services (Win + R, type `services.msc`)
2. Look for "MySQL" or "MySQL80" service
3. Right-click and select "Start" if it's stopped

### Check via Command Line:
```powershell
# Check MySQL service status
Get-Service -Name "*mysql*"

# Or check if port 3306 is listening
netstat -an | findstr :3306
```

## Step 2: Verify Database Configuration

Your current `.env` settings:
```
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=sia_app
DB_USERNAME=root
DB_PASSWORD=
```

### Common Issues:
1. **Wrong Port**: If MySQL is on a different port, update `DB_PORT`
2. **Wrong Host**: If using XAMPP, try `localhost` instead of `127.0.0.1`
3. **Database Doesn't Exist**: Create the database first (see Step 3)
4. **Wrong Password**: If MySQL has a password, add it to `DB_PASSWORD`

## Step 3: Create the Database

1. Open phpMyAdmin (usually at http://localhost/phpmyadmin)
2. Or use MySQL command line:
```sql
CREATE DATABASE sia_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## Step 4: Test Connection

### Option 1: Test via Laravel Tinker
```bash
cd "Backend -Laravel"
php artisan tinker
DB::connection()->getPdo();
```

### Option 2: Test via Command
```bash
php artisan migrate:status
```

## Step 5: Alternative Solutions

### If MySQL won't start:
1. Check if port 3306 is already in use:
   ```powershell
   netstat -ano | findstr :3306
   ```
2. Check MySQL error logs (usually in XAMPP/mysql/data/ or MySQL installation folder)
3. Try restarting your computer

### If using XAMPP:
- Make sure Apache and MySQL are both running
- Check XAMPP logs for errors

### If using WAMP:
- Make sure MySQL service is running in WAMP tray icon
- Right-click WAMP icon → MySQL → Service → Start/Resume Service

### If using Laragon:
- Check Laragon control panel
- Make sure MySQL is started

## Quick Fix: Try Different Host

Sometimes `127.0.0.1` doesn't work. Try changing in `.env`:
```
DB_HOST=localhost
```

Or if using a different MySQL installation:
```
DB_HOST=127.0.0.1
DB_PORT=3307  # or whatever port your MySQL uses
```

## Still Not Working?

1. Check Windows Firewall isn't blocking MySQL
2. Verify MySQL is installed and working:
   ```bash
   mysql -u root -p
   ```
3. Check Laravel logs: `storage/logs/laravel.log`
4. Clear config cache:
   ```bash
   php artisan config:clear
   php artisan cache:clear
   ```


