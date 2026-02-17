# 🚨 SETUP EMAIL RIGHT NOW - 2 MINUTES

## Option 1: Use Setup Script (EASIEST)

1. Open terminal in `Backend -Laravel` folder
2. Run: `php setup-email.php`
3. Enter your Gmail when prompted
4. Enter your Gmail App Password when prompted
5. Run: `php artisan config:clear`
6. Restart Laravel server
7. DONE! ✅

## Option 2: Manual Setup (If script doesn't work)

### Step 1: Get Gmail App Password
- Go to: https://myaccount.google.com/apppasswords
- Enable 2-Step Verification if needed
- Generate App Password:
  - App: Mail
  - Device: Other → Name: SIA System
  - Copy the 16-character password

### Step 2: Edit .env File
Open `Backend -Laravel/.env` and find these lines:

```
MAIL_USERNAME=your-gmail@gmail.com
MAIL_PASSWORD=your-app-password-here
MAIL_FROM_ADDRESS="your-gmail@gmail.com"
```

**REPLACE with:**
```
MAIL_USERNAME=youractualemail@gmail.com
MAIL_PASSWORD=abcdefghijklmnop
MAIL_FROM_ADDRESS="youractualemail@gmail.com"
```

**IMPORTANT:**
- Remove ALL spaces from app password
- Use the SAME email for both USERNAME and FROM_ADDRESS

### Step 3: Clear Cache
```bash
php artisan config:clear
```

### Step 4: Restart Server
Restart your Laravel development server

## ✅ That's It!

After this, when students log in:
1. They enter their email (e.g., student1@gmail.com)
2. System sends verification code TO student1@gmail.com
3. Student receives code in their Gmail inbox
4. Student enters code to verify

**The system sends to the student's email - you just need to configure ONE Gmail account for sending!**

