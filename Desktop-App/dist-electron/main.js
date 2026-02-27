import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
// Get the Windows Computer Name (Hostname) for lab tracking
const COMPUTER_NAME = os.hostname();
console.log(`🖥️ Computer Name (Hostname): ${COMPUTER_NAME}`);
// Read API base URL from .env file (single source of truth)
let API_BASE_URL = 'http://127.0.0.1:8000';
try {
    const envPath = path.join(__dirname, '../.env');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf-8');
        const match = envContent.match(/^VITE_API_BASE_URL\s*=\s*(.+)/m);
        if (match) {
            API_BASE_URL = match[1].trim().replace(/["']/g, '');
            // Remove trailing slash if present
            if (API_BASE_URL.endsWith('/'))
                API_BASE_URL = API_BASE_URL.slice(0, -1);
        }
    }
}
catch (e) {
    console.log('⚠️ Could not read .env file, using default API URL');
}
console.log(`🌐 API Base URL: ${API_BASE_URL}`);
// Import monitoring server (using require for CommonJS module)
const { startMonitoringServer, setStudentCredentials, clearStudentCredentials, setComputerName, setApiBaseUrl } = require('./monitoring-server.cjs');
// Handle creating/removing shortcuts on Windows when installing/uninstalling
try {
    if (require('electron-squirrel-startup')) {
        app.quit();
    }
}
catch (e) {
    // electron-squirrel-startup is optional
}
let mainWindow = null;
let profileWindow = null;
const createWindow = () => {
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
    // Determine preload path - always use compiled JS
    const preloadPath = isDev
        ? path.join(__dirname, '../dist-electron/preload.js')
        : path.join(__dirname, 'preload.js');
    // Create the browser window - frameless, fullscreen for lock screen
    mainWindow = new BrowserWindow({
        width: 1920,
        height: 1080,
        fullscreen: true,
        frame: false, // Remove window controls (minimize, maximize, close)
        webPreferences: {
            preload: preloadPath,
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
        },
        backgroundColor: '#1e293b', // Dark background
        alwaysOnTop: true, // Keep on top until unlocked
    });
    // Load the app
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        // Open DevTools in development (comment out for production)
        // mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
    // Remove menu bar
    mainWindow.setMenuBarVisibility(false);
    // Prevent window from being closed accidentally
    mainWindow.on('close', (event) => {
        // In production, prevent closing
        if (!isDev) {
            event.preventDefault();
        }
    });
};
const createProfileWindow = () => {
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
    const preloadPath = isDev
        ? path.join(__dirname, '../dist-electron/preload.js')
        : path.join(__dirname, 'preload.js');
    // Get primary display dimensions
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    // Create full-screen transparent overlay for draggable widget
    profileWindow = new BrowserWindow({
        width: width,
        height: height,
        x: 0,
        y: 0,
        frame: false, // No window controls
        transparent: true, // Transparent background
        alwaysOnTop: true, // Always on top so it stays visible
        skipTaskbar: true, // Don't show in taskbar
        resizable: false,
        webPreferences: {
            preload: preloadPath,
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
        },
        backgroundColor: '#00000000', // Transparent
        focusable: false, // Don't steal focus from other apps
        hasShadow: false, // No shadow for cleaner look
    });
    // Make window click-through by default (allows clicking desktop behind it)
    profileWindow.setIgnoreMouseEvents(true, { forward: true });
    // Load profile overlay page with overlay parameter
    if (isDev) {
        profileWindow.loadURL('http://localhost:5173/?overlay=profile');
    }
    else {
        // For production, use query string in the URL
        const indexPath = path.join(__dirname, '../dist/index.html');
        profileWindow.loadURL(`file://${indexPath}?overlay=profile`);
    }
    profileWindow.setMenuBarVisibility(false);
};
// IPC handlers for window control
ipcMain.handle('minimize-main-window', () => {
    if (mainWindow) {
        // Remove alwaysOnTop so user can access desktop
        mainWindow.setAlwaysOnTop(false);
        mainWindow.minimize();
        // Hide window completely
        mainWindow.hide();
    }
});
ipcMain.handle('show-profile-overlay', () => {
    if (!profileWindow) {
        createProfileWindow();
    }
    else {
        profileWindow.show();
    }
});
// IPC handler for draggable widget mouse events
ipcMain.handle('set-ignore-mouse-events', (event, ignore, options) => {
    if (profileWindow) {
        profileWindow.setIgnoreMouseEvents(ignore, options);
    }
});
ipcMain.handle('hide-profile-overlay', () => {
    if (profileWindow) {
        profileWindow.hide();
    }
});
ipcMain.handle('logout', () => {
    // Close profile window
    if (profileWindow) {
        profileWindow.close();
        profileWindow = null;
    }
    // Show main window again and restore alwaysOnTop
    if (mainWindow) {
        mainWindow.setAlwaysOnTop(true);
        mainWindow.show();
        mainWindow.restore();
        mainWindow.focus();
    }
    // Clear monitoring credentials
    clearStudentCredentials();
});
// IPC handler for student login (for browser monitoring)
ipcMain.handle('student-logged-in', (event, studentData) => {
    setStudentCredentials({
        email: studentData.email,
        token: studentData.token,
        userId: studentData.userId,
        fullName: studentData.fullName,
        computerName: COMPUTER_NAME
    });
});
// IPC handler for student logout (for browser monitoring)
ipcMain.handle('student-logged-out', () => {
    clearStudentCredentials();
});
// This method will be called when Electron has finished initialization
app.on('ready', () => {
    createWindow();
    setComputerName(COMPUTER_NAME); // Set the hostname for the monitoring server
    setApiBaseUrl(API_BASE_URL); // Set the API URL for heartbeats
    startMonitoringServer(); // Start monitoring server on port 9876
});
// Quit when all windows are closed
app.on('window-all-closed', () => {
    // On macOS, keep app running even when all windows are closed
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
app.on('activate', () => {
    // On macOS, re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
