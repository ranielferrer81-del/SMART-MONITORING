# 🚨 QUICK FIX - Update Gmail Credentials NOW

## The Problem:
Your `.env` file has placeholder values. You MUST replace them with your actual Gmail credentials.

## ⚡ FASTEST WAY TO FIX:

### 1. Open this file: `Backend -Laravel/.env`

### 2. Find these 3 lines and REPLACE them:

**FIND:**
```
MAIL_USERNAME=your-gmail@gmail.com
MAIL_PASSWORD=your-app-password-here
MAIL_FROM_ADDRESS="your-gmail@gmail.com"
```

**REPLACE WITH YOUR ACTUAL GMAIL:**
```
MAIL_USERNAME=youractualemail@gmail.com
MAIL_PASSWORD=your16characterapppassword
MAIL_FROM_ADDRESS="youractualemail@gmail.com"
```

### 3. Get Gmail App Password (if you don't have one):

1. Go to: **https://myaccount.google.com/apppasswords**
2. Enable 2-Step Verification first (if not enabled)
3. Generate App Password:
   - App: **Mail**
   - Device: **Other** → Name: **SIA System**
   - Click **Generate**
   - **Copy the password** (16 characters like: `abcd efgh ijkl mnop`)
   - **REMOVE ALL SPACES** when pasting: `abcdefghijklmnop`

### 4. After updating .env, run:
```bash
php artisan config:clear
```

### 5. Restart your Laravel server

## ✅ Example:
If your email is `student1@gmail.com` and app password is `abcd efgh ijkl mnop`:

```env
MAIL_USERNAME=student1@gmail.com
MAIL_PASSWORD=abcdefghijklmnop
MAIL_FROM_ADDRESS="student1@gmail.com"
```

## ⚠️ CRITICAL:
- Use **App Password**, NOT your regular Gmail password
- Remove **ALL SPACES** from the app password
- Use the **SAME email** for USERNAME and FROM_ADDRESS
- **Save the file** after editing
- **Clear config cache** after saving

After this, emails will work! ✅

