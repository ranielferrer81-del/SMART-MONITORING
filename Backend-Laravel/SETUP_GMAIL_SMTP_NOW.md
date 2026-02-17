# 🚨 SETUP GMAIL SMTP NOW - REQUIRED FOR EMAILS TO WORK

## The Problem
Your `.env` file has placeholder values, so emails are NOT being sent. The app says "email sent" but nothing arrives.

## ✅ SOLUTION - Follow These Steps:

### Step 1: Get Gmail App Password

1. Go to: **https://myaccount.google.com/apppasswords**
2. If you see "App passwords aren't available for your account":
   - Go to: https://myaccount.google.com/security
   - Enable **2-Step Verification** first
   - Then go back to app passwords
3. Generate App Password:
   - Click "Select app" → Choose **Mail**
   - Click "Select device" → Choose **Other (Custom name)**
   - Type: **SIA System**
   - Click **Generate**
4. **COPY the 16-character password** (example: `abcd efgh ijkl mnop`)
5. **REMOVE ALL SPACES**: `abcdefghijklmnop`

### Step 2: Update .env File

1. Open: `Backend -Laravel\.env`
2. Find these 3 lines (around line 55-58):
   ```
   MAIL_USERNAME=your-gmail@gmail.com
   MAIL_PASSWORD=your-app-password-here
   MAIL_FROM_ADDRESS="your-gmail@gmail.com"
   ```
3. **REPLACE with YOUR actual Gmail:**
   ```
   MAIL_USERNAME=youractualemail@gmail.com
   MAIL_PASSWORD=abcdefghijklmnop
   MAIL_FROM_ADDRESS="youractualemail@gmail.com"
   ```
   
   **IMPORTANT:**
   - Use the **SAME Gmail** for both USERNAME and FROM_ADDRESS
   - Use the **App Password** (16 characters, no spaces), NOT your regular password
   - Remove quotes around FROM_ADDRESS value

### Step 3: Clear Cache

Run this command in `Backend -Laravel` folder:
```bash
php artisan config:clear
```

### Step 4: Restart Laravel Server

Stop and restart your `php artisan serve` command.

### Step 5: Test

1. Try logging in with a student email
2. Check the student's Gmail inbox
3. Check spam folder too

## ✅ Example:

If your Gmail is: `admin@gmail.com`
And App Password is: `abcd efgh ijkl mnop`

Then in `.env`:
```
MAIL_USERNAME=admin@gmail.com
MAIL_PASSWORD=abcdefghijklmnop
MAIL_FROM_ADDRESS="admin@gmail.com"
```

## ⚠️ CRITICAL NOTES:

- **App Password is DIFFERENT from your Gmail password**
- **Remove ALL spaces** from app password
- **Use the SAME email** for USERNAME and FROM_ADDRESS
- **Save the .env file** after editing
- **Clear config cache** after saving
- **Restart server** after clearing cache

## After This:

✅ Emails will be sent to students' Gmail accounts
✅ Students will receive verification codes in their inbox
✅ Works on localhost - no server needed

