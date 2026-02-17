# URGENT: Update .env File for Gmail

## The Problem
Your `.env` file currently has `MAIL_MAILER=log` which only logs emails instead of sending them.

## Quick Fix - Follow These Steps:

### 1. Open your `.env` file in `Backend -Laravel/.env`

### 2. Find these lines and REPLACE them:

**OLD (Current - WRONG):**
```
MAIL_MAILER=log
MAIL_SCHEME=null
MAIL_HOST=127.0.0.1
MAIL_PORT=2525
MAIL_USERNAME=null
MAIL_PASSWORD=null
MAIL_FROM_ADDRESS="hello@example.com"
MAIL_FROM_NAME="${APP_NAME}"
```

**NEW (Replace with this - CORRECT):**
```
MAIL_MAILER=smtp
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=your-gmail@gmail.com
MAIL_PASSWORD=your-gmail-app-password
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS="your-gmail@gmail.com"
MAIL_FROM_NAME="SIA"
```

### 3. Get Gmail App Password:
1. Go to: https://myaccount.google.com/apppasswords
2. Enable 2-Step Verification if needed
3. Generate App Password:
   - Select "Mail" → "Other (Custom name)"
   - Name: "SIA System"
   - Copy the 16-character password (remove spaces when pasting)

### 4. Replace in .env:
- `your-gmail@gmail.com` → Your actual Gmail address
- `your-gmail-app-password` → The 16-character app password (NO SPACES)

### 5. Save the file and run:
```bash
php artisan config:clear
```

### 6. Restart your Laravel server

## Example .env Configuration:
```
MAIL_MAILER=smtp
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=student1@gmail.com
MAIL_PASSWORD=abcd efgh ijkl mnop
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS="student1@gmail.com"
MAIL_FROM_NAME="SIA"
```

**IMPORTANT:** 
- Use App Password, NOT your regular Gmail password
- Remove spaces from app password: `abcdefghijklmnop` not `abcd efgh ijkl mnop`
- Both MAIL_USERNAME and MAIL_FROM_ADDRESS should be the SAME Gmail address

