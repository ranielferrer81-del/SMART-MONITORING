# Email Setup Instructions for Gmail

## Quick Setup Steps:

1. **Enable 2-Factor Authentication on your Gmail account**
   - Go to: https://myaccount.google.com/security
   - Enable 2-Step Verification

2. **Generate an App Password**
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Custom name)"
   - Enter "SIA System" as the name
   - Click "Generate"
   - Copy the 16-character password (it will look like: xxxx xxxx xxxx xxxx)

3. **Update your `.env` file** (or `env` file) with:
   ```
   MAIL_MAILER=smtp
   MAIL_HOST=smtp.gmail.com
   MAIL_PORT=587
   MAIL_USERNAME=your-actual-email@gmail.com
   MAIL_PASSWORD=xxxx xxxx xxxx xxxx  (the app password from step 2, remove spaces)
   MAIL_ENCRYPTION=tls
   MAIL_FROM_ADDRESS="your-actual-email@gmail.com"
   MAIL_FROM_NAME="SIA"
   ```

4. **Clear config cache** (if needed):
   ```bash
   php artisan config:clear
   ```

## Important Notes:
- Use the **App Password**, NOT your regular Gmail password
- Remove spaces from the app password when pasting
- The MAIL_USERNAME and MAIL_FROM_ADDRESS should be the same Gmail address
- After updating, restart your Laravel server

## Testing:
After setup, try logging in again. The verification code should be sent to the email address you're logging in with.

