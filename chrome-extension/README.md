# SIA Student Activity Monitor - Chrome Extension

## Installation Instructions

### For Students:

1. **Download the Extension**
   - Get the `chrome-extension` folder from your teacher

2. **Install in Chrome**
   - Open Chrome browser
   - Go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right corner)
   - Click "Load unpacked"
   - Select the `chrome-extension` folder
   - The extension icon should appear in your toolbar

3. **Login**
   - Click the extension icon in your toolbar
   - Enter your student email and password
   - Click "Login"
   - You should see "Status: ● Active"

4. **During Exams/Activities**
   - Keep the extension enabled at all times
   - Your browsing activity will be monitored
   - Do NOT use incognito mode (it will alert your teacher)
   - Do NOT disable the extension

### Important Notes:

- ⚠️ **Privacy**: All your browsing activity is being monitored and logged
- 🚫 **Incognito Mode**: Opening incognito windows will immediately alert your teacher
- 📋 **What's Tracked**: Every URL you visit, page titles, and time spent
- ✅ **Allowed**: Only browse websites permitted by your teacher during exams

### For Teachers/Admins:

The monitoring dashboard is available in your admin/teacher panel on the SIA web application.

## Troubleshooting:

**Extension not working?**
- Make sure you're logged in (click the extension icon)
- Check that "Status" shows "● Active"
- Refresh the page you're on

**Can't login?**
- Verify your email and password are correct
- Make sure the backend server is running (http://127.0.0.1:8000)
- Check your internet connection

## Technical Details:

- **Backend API**: http://127.0.0.1:8000/api
- **Web App**: http://localhost:3000
- **Permissions**: Tabs, Web Navigation, Storage, Active Tab
- **Data Logged**: URL, Page Title, Timestamp, Duration, Incognito Status
