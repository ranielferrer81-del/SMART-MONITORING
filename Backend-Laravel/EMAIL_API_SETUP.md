# 🚀 QUICK EMAIL API SETUP - WORKS IMMEDIATELY

## Option 1: SendGrid (RECOMMENDED - Free 100 emails/day)

1. **Sign up for free:** https://signup.sendgrid.com/
2. **Get API Key:**
   - Go to Settings → API Keys
   - Create API Key → Full Access
   - Copy the key
3. **Add to .env:**
   ```
   SENDGRID_API_KEY=SG.your-actual-api-key-here
   ```
4. **Run:** `php artisan config:clear`
5. **Restart server**
6. **DONE!** ✅ Emails will be sent via SendGrid API

## Option 2: Mailgun (Free 5,000 emails/month)

1. **Sign up:** https://signup.mailgun.com/
2. **Get API Key and Domain** from dashboard
3. **Add to .env:**
   ```
   MAILGUN_DOMAIN=your-domain.mailgun.org
   MAILGUN_SECRET=your-mailgun-api-key
   ```
4. **Run:** `php artisan config:clear`
5. **Restart server**
6. **DONE!** ✅

## Option 3: Gmail SMTP (Requires App Password)

1. Get Gmail App Password: https://myaccount.google.com/apppasswords
2. Update .env:
   ```
   MAIL_USERNAME=youractualemail@gmail.com
   MAIL_PASSWORD=yourapppassword
   MAIL_FROM_ADDRESS="youractualemail@gmail.com"
   ```
3. **Run:** `php artisan config:clear`
4. **Restart server**

## ⚡ FASTEST: Use SendGrid (5 minutes setup)

The system will automatically try:
1. SendGrid API (if configured)
2. Mailgun API (if configured)  
3. Gmail SMTP (if configured)
4. PHP mail() (fallback)

**Just add ONE of these to .env and emails will work!**

