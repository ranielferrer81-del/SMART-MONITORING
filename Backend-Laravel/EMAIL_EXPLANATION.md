# How Email Verification Works

## ✅ What Happens:
1. **Student enters their email** (e.g., `student1@gmail.com`)
2. **System sends verification code** to that student's email address
3. **Student receives code** in their Gmail inbox
4. **Student enters code** to verify

## 🔧 What Needs to be Configured:

To **SEND** emails, the server needs SMTP credentials. This is like having a "sender account" that Gmail trusts.

**Think of it like this:**
- The student's email = **RECIPIENT** (who gets the email) ✅ Already works!
- The server's email = **SENDER** (who sends the email) ⚠️ Needs configuration

## 📧 Current Setup:

The system is trying to send emails **TO** the student's email address, but it can't because:
- The server doesn't have Gmail SMTP credentials configured
- Gmail requires authentication to send emails through their servers

## 🛠️ Solution:

You need to configure **ONE Gmail account** in the `.env` file that will be used to **SEND** emails to all students.

**This sender email:**
- Can be any Gmail account (yours, admin's, etc.)
- Only used to authenticate with Gmail's SMTP server
- Does NOT affect who receives the emails
- Students still receive emails at their own email addresses

## Example:

**Student logs in with:** `student1@gmail.com`
**System sends code TO:** `student1@gmail.com` ✅
**System uses sender:** `admin@gmail.com` (configured in .env) - just for authentication

The student receives the email at `student1@gmail.com` - their own email!

## Quick Fix:

1. Get Gmail App Password for any Gmail account (yours or admin's)
2. Update `.env` with that account's credentials
3. System will then send emails to students' email addresses

See `QUICK_FIX_EMAIL.md` for step-by-step instructions.

