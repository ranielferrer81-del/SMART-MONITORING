# ⚡ QUICK START - Email Setup (2 Minutes)

## What You Need
1. A Gmail account (can be your personal Gmail or create a new one)
2. 2 minutes to set up

## Step-by-Step

### 1️⃣ Get Gmail App Password (1 minute)
```
→ Go to: https://myaccount.google.com/apppasswords
→ Enable 2-Step Verification (if not enabled)
→ Create App Password: Mail → Other → "SIA System"
→ Copy the password: abcd efgh ijkl mnop
→ Remove spaces: abcdefghijklmnop
```

### 2️⃣ Update .env File (30 seconds)
```bash
# Open: Backend -Laravel\.env
# Find and replace these 3 lines:

MAIL_USERNAME=youremail@gmail.com
MAIL_PASSWORD=abcdefghijklmnop
MAIL_FROM_ADDRESS="youremail@gmail.com"
```

### 3️⃣ Clear Cache (10 seconds)
```bash
cd Backend -Laravel
php artisan config:clear
```

### 4️⃣ Restart Server (10 seconds)
```bash
# Stop server (Ctrl+C)
php artisan serve
```

### 5️⃣ Test (20 seconds)
```
→ Login with any student email
→ Check that student's inbox
→ Done! ✅
```

---

## Important Points

✅ **One Gmail sends to ALL users**
- System email in .env: `admin@gmail.com`
- Student 1: `student1@gmail.com` → receives code ✅
- Student 2: `student2@gmail.com` → receives code ✅
- Student 3: `student3@gmail.com` → receives code ✅

✅ **Use App Password, NOT regular password**

✅ **Remove spaces from app password**

---

## Example

If your Gmail is `myemail@gmail.com` and app password is `abcd efgh ijkl mnop`:

```env
MAIL_USERNAME=myemail@gmail.com
MAIL_PASSWORD=abcdefghijklmnop
MAIL_FROM_ADDRESS="myemail@gmail.com"
```

**That's it!** Now all users get verification codes.

