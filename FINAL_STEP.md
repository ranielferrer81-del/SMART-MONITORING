# Final Step: Add Monitoring Dashboard to Admin Panel

## Quick Copy-Paste Instructions

Open this file in VS Code:
`c:\Users\ranie\OneDrive\Desktop\Sia-Web\myreactapp-React\src\components\admin_dashboard\AdminDashboard.js`

**Find line 2196** which says:
```javascript
      {/* Edit Account Modal */}
```

**Add these lines RIGHT BEFORE that line:**

```javascript
      {/* Browser Monitoring Section */}
      {activeSection === 'monitoring' && (
        <div className="bg-white/10 backdrop-blur-sm shadow-2xl rounded-2xl border border-slate-200/60 p-4 lg:p-6 dark:bg-slate-900/10 dark:border-slate-800/60">
          <BrowserMonitoringDashboard 
            userRole="admin"
            enrolledStudents={[...studentsBSIT, ...studentsBSCS, ...studentsBSEMC]}
          />
        </div>
      )}

```

**That's it!** Save the file and the monitoring dashboard will appear when you click "Browser Monitoring" in the Admin sidebar.

---

## Then You're Ready to Test!

1. **Open browser** → `http://localhost:3000`
2. **Login as admin**
3. **Click "Browser Monitoring"** in sidebar
4. **See the dashboard!** (no data yet until students use the extension)

To test with data:
1. Install Chrome extension
2. Login as student in extension
3. Browse some websites
4. Refresh admin dashboard → See activity!

---

## Summary of What's Complete

✅ Backend API - All endpoints working
✅ Chrome Extension - Ready to install (icons created)
✅ Monitoring Dashboard Component - Built
✅ Admin Sidebar Button - Added
⚠️ **Just need to add the 10 lines above** - Then 100% complete!
