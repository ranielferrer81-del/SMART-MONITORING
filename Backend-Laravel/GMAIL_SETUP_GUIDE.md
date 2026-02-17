# Gmail Setup - Step by Step Guide

## ⚠️ IMPORTANT: You MUST follow these steps exactly!

### Step 1: Get Gmail App Password

1. **Go to Google Account Security:**
   - Visit: https://myaccount.google.com/security
   - Make sure **2-Step Verification is ENABLED** (required!)

2. **Generate App Password:**
   - Go to: https://myaccount.google.com/apppasswords
   - If you don't see this option, enable 2-Step Verification first
   - Select:
     - **App:** Mail
     - **Device:** Other (Custom name)
     - **Name:** SIA System
   - Click **Generate**
   - **Copy the 16-character password** (it looks like: `abcd efgh ijkl mnop`)

### Step 2: Update .env File

1. **Open:** `Backend -Laravel/.env`

2. **Find these lines:**
   ```
   MAIL_USERNAME=your-gmail@gmail.com
   MAIL_PASSWORD=your-app-password-here
   MAIL_FROM_ADDRESS="your-gmail@gmail.com"
   ```

3. **Replace with YOUR actual Gmail:**
   ```
   MAIL_USERNAME=youractualemail@gmail.com
   MAIL_PASSWORD=abcdefghijklmnop
   MAIL_FROM_ADDRESS="youractualemail@gmail.com"
   ```

   **CRITICAL:**
   - Use the **SAME Gmail address** for both USERNAME and FROM_ADDRESS
   - Remove **ALL SPACES** from the App Password
   - Use the **App Password**, NOT your regular Gmail password

### Step 3: Clear Cache

Run in terminal (in Backend -Laravel folder):
```bash
php artisan config:clear
```

### Step 4: Restart Laravel Server

Stop and restart your Laravel development server.

## Example:

If your Gmail is `student1@gmail.com` and your App Password is `abcd efgh ijkl mnop`:

```env
MAIL_USERNAME=student1@gmail.com
MAIL_PASSWORD=abcdefghijklmnop
MAIL_FROM_ADDRESS="student1@gmail.com"
```

## Common Mistakes:

❌ Using regular Gmail password instead of App Password
❌ Not removing spaces from App Password
❌ Using different emails for USERNAME and FROM_ADDRESS
❌ Not enabling 2-Step Verification first
❌ Not clearing config cache after updating

## Test:

After setup, try logging in again. The verification code should be sent to the email.

