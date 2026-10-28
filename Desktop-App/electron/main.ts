import { app, BrowserWindow, ipcMain } from 'electron';
import { execFileSync, execSync } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const defaultGateway = require('default-gateway');

// Get the Windows Computer Name (Hostname) for lab tracking
const COMPUTER_NAME = os.hostname();
console.log(`🖥️ Computer Name (Hostname): ${COMPUTER_NAME}`);

function normalizeApiBaseUrl(url: string): string {
  // Dotenv does not treat "||" as OR — strip accidental "url || fallback" paste mistakes.
  let u = url.trim().replace(/^["']|["']$/g, '').split(/\s+\|\|/)[0]?.trim() ?? '';
  if (u.endsWith('/')) u = u.slice(0, -1);
  if (u.toLowerCase().endsWith('/api')) {
    u = u.slice(0, -4);
    if (u.endsWith('/')) u = u.slice(0, -1);
  }
  return u;
}

function readApiBaseFromDotEnv(): string | null {
  try {
    const envPath = path.join(__dirname, '../.env');
    if (!fs.existsSync(envPath)) return null;
    const match = fs.readFileSync(envPath, 'utf-8').match(/^VITE_API_BASE_URL\s*=\s*(.+)/m);
    if (!match) return null;
    return normalizeApiBaseUrl(match[1].trim().replace(/["']/g, ''));
  } catch {
    return null;
  }
}

function readApiBaseFromBuildConfig(): string | null {
  try {
    const cfgPath = path.join(__dirname, 'build-config.json');
    if (!fs.existsSync(cfgPath)) return null;
    const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf-8')) as {
      viteApiBaseUrl?: unknown;
    };
    const raw = parsed.viteApiBaseUrl;
    return typeof raw === 'string' && raw.trim() ? normalizeApiBaseUrl(raw) : null;
  } catch {
    return null;
  }
}

const DEFAULT_API_BASE_URL = 'https://smart-monitoring-production.up.railway.app';
const LOCAL_API_URL = 'http://127.0.0.1:8000';

/** Packaged builds use build-config.json from CI; dev prefers .env or cloud */
function resolveApiBaseUrl(): string {
  const fromBuildConfig = readApiBaseFromBuildConfig();
  const fromEnvFile = readApiBaseFromDotEnv();
  if (app.isPackaged) {
    return fromBuildConfig ?? DEFAULT_API_BASE_URL;
  }
  return fromEnvFile ?? fromBuildConfig ?? DEFAULT_API_BASE_URL;
}

const API_BASE_URL = resolveApiBaseUrl();
console.log(`🌐 API Base URL: ${API_BASE_URL}`);

// Import monitoring server (using require for CommonJS module)
const {
  startMonitoringServer,
  setStudentCredentials,
  clearStudentCredentials,
  mergeDesktopHeartbeatFields,
  setComputerName,
  setGatewayIp,
  setApiBaseUrl,
  registerLockStateCallback,
  registerPresentationStateCallback,
  registerQuizStateCallback,
  getStudentToken,
} = require('./monitoring-server.cjs');

let GATEWAY_IP: string | null = null;
/** Timestamp when student completes PIN (monitoringReady); cleared on logout. */
let monitoringReadyStickyIso: string | null = null;

const IPV4_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

/**
 * default-gateway often fails inside Electron on Windows. Use OS tooling instead.
 */
function resolveGatewayWindowsSync(): string | null {
  const systemRoot = process.env.SystemRoot || 'C:\\Windows';
  const ps = path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');

  try {
    const out = execFileSync(
      fs.existsSync(ps) ? ps : 'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        "(Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | " +
          "Where-Object { $_.NextHop -and $_.NextHop -ne '0.0.0.0' } | " +
          'Sort-Object RouteMetric | Select-Object -First 1 -ExpandProperty NextHop)',
      ],
      { encoding: 'utf-8', windowsHide: true, timeout: 15000 }
    ).trim();
    if (IPV4_RE.test(out)) return out;
  } catch {
    // fall through to ipconfig
  }

  try {
    const out = execSync('ipconfig', { encoding: 'utf-8', windowsHide: true, timeout: 15000 });
    let last: string | null = null;
    for (const line of out.split(/\r?\n/)) {
      const m = line.match(/Default Gateway[^:]*:\s*(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/i);
      if (m?.[1] && m[1] !== '0.0.0.0') last = m[1];
    }
    return last;
  } catch {
    return null;
  }
}

async function resolveGatewayIp() {
  try {
    let gw: string | null = null;
    if (process.platform === 'win32') {
      gw = resolveGatewayWindowsSync();
    }
    if (!gw) {
      const { gateway } = await defaultGateway.v4();
      gw = gateway || null;
    }
    GATEWAY_IP = gw;
    setGatewayIp(GATEWAY_IP);
    console.log(`🌐 Default Gateway (IPv4): ${GATEWAY_IP || 'N/A'}`);
  } catch {
    if (process.platform === 'win32') {
      GATEWAY_IP = resolveGatewayWindowsSync();
      setGatewayIp(GATEWAY_IP);
      console.log(`🌐 Default Gateway (IPv4, Windows fallback): ${GATEWAY_IP || 'N/A'}`);
    } else {
      GATEWAY_IP = null;
      setGatewayIp(null);
      console.log('⚠️ Could not resolve default gateway');
    }
  }
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling
try {
  if (require('electron-squirrel-startup')) {
    app.quit();
  }
} catch (e) {
  // electron-squirrel-startup is optional
}

let mainWindow: BrowserWindow | null = null;
let profileWindow: BrowserWindow | null = null;
/** Staff "Exit app" only — allows quitting the process. */
let allowAppQuit = false;
/** Login lock screen fullscreen/kiosk is active. */
let lockScreenEnforced = false;
/** After PIN: student is in session; app must stay running until Logout. */
let studentSessionActive = false;
/** Live screen share presentation from instructor is currently active. */
let presentationActive = false;
/** A quiz is active for this student; screen stays locked until they dismiss the result screen. */
let quizActive = false;
/** Instructor has remotely locked this PC. */
let remoteLockActive = false;

/** Packaged .exe and production builds enforce kiosk-style lock on the login screen. */
const shouldEnforceLockScreen = app.isPackaged || process.env.SIA_LOCK_SCREEN === 'true';

function isStudentExitBlocked(): boolean {
  return shouldEnforceLockScreen && !allowAppQuit;
}

/** Block close shortcuts on lock screen and while a student session or presentation is active. */
function shouldBlockSystemShortcuts(): boolean {
  if (!isStudentExitBlocked()) return false;
  return lockScreenEnforced || studentSessionActive || presentationActive || quizActive;
}

function applyLockScreenMode(win: BrowserWindow) {
  if (!win || win.isDestroyed()) return;
  if (!shouldEnforceLockScreen) {
    lockScreenEnforced = false;
    win.setAlwaysOnTop(false);
    win.setFullScreen(false);
    return;
  }
  lockScreenEnforced = true;
  win.setMenuBarVisibility(false);
  win.setResizable(false);
  win.setMinimizable(false);
  win.setMaximizable(false);
  win.setFullScreenable(false);
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setKiosk(true);
  win.setFullScreen(true);
  win.focus();
}

function attachLockScreenInputGuards(win: BrowserWindow) {
  win.webContents.on('before-input-event', (event, input) => {
    if (!shouldBlockSystemShortcuts()) return;

    const key = input.key?.toLowerCase() ?? '';
    const block =
      key === 'f11' ||
      key === 'f12' ||
      key === 'escape' ||
      (input.alt && key === 'tab') ||
      (input.alt && key === 'f4') ||
      ((input.control || input.meta) && key === 'w') ||
      ((input.control || input.meta) && key === 'r') ||
      (input.alt && key === 'enter') ||
      (input.control && input.shift && key === 'escape');

    if (block) {
      event.preventDefault();
    }
  });

  win.on('leave-full-screen', () => {
    if (lockScreenEnforced && !win.isDestroyed()) {
      win.setFullScreen(true);
      if (shouldEnforceLockScreen) {
        win.setKiosk(true);
      }
    }
  });
}

function attachWindowCloseGuard(win: BrowserWindow, isDevBuild: boolean) {
  win.on('close', (event) => {
    if (!isDevBuild && isStudentExitBlocked()) {
      event.preventDefault();
    }
  });
}

const createWindow = () => {
  const isDevBuild = process.env.NODE_ENV === 'development' || !app.isPackaged;

  // Determine preload path - always use compiled JS
  const preloadPath = isDevBuild
    ? path.join(__dirname, '../dist-electron/preload.js')
    : path.join(__dirname, 'preload.js');

  // Create the browser window - frameless, fullscreen for lock screen (unless dev)
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    fullscreen: shouldEnforceLockScreen,
    frame: !shouldEnforceLockScreen, // Show window controls in dev
    kiosk: shouldEnforceLockScreen,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    backgroundColor: '#1e293b', // Dark background
    alwaysOnTop: shouldEnforceLockScreen, // Keep on top until unlocked (unless dev)
    resizable: !shouldEnforceLockScreen,
    minimizable: !shouldEnforceLockScreen,
    maximizable: !shouldEnforceLockScreen,
    fullscreenable: true, // Allow manual fullscreening in dev
  });

  attachLockScreenInputGuards(mainWindow);
  applyLockScreenMode(mainWindow);

  // Load the app
  if (isDevBuild) {
    mainWindow.loadURL('http://localhost:5173');
    // Open DevTools in development (comment out for production)
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Forward renderer console logs to the main process terminal
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer Main] ${message}`);
  });

  // Remove menu bar only if lock screen is enforced
  if (shouldEnforceLockScreen) {
    mainWindow.setMenuBarVisibility(false);
  }

  attachWindowCloseGuard(mainWindow, isDevBuild);
};

const createProfileWindow = () => {
  const isDevBuild = process.env.NODE_ENV === 'development' || !app.isPackaged;

  const preloadPath = isDevBuild
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
  if (isDevBuild) {
    profileWindow.loadURL('http://localhost:5173/?overlay=profile');
  } else {
    profileWindow.loadFile(path.join(__dirname, '../dist/index.html'), { query: { overlay: 'profile' } });
  }

  profileWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer Profile] ${message}`);
  });

  profileWindow.setMenuBarVisibility(false);
  attachLockScreenInputGuards(profileWindow);
  attachWindowCloseGuard(profileWindow, isDevBuild);
};

// IPC handlers for window control
ipcMain.handle('minimize-main-window', () => {
  if (quizActive) return; // cannot leave the screen during a quiz
  if (mainWindow) {
    // Keep kiosk/lock flags; only hide so students cannot "unlock" by PIN.
    mainWindow.hide();
  }
});

ipcMain.handle('show-profile-overlay', () => {
  if (!profileWindow) {
    createProfileWindow();
  } else {
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
  monitoringReadyStickyIso = null;
  studentSessionActive = false;
  quizActive = false;
  remoteLockActive = false;
  clearStudentCredentials();

  if (profileWindow && !profileWindow.isDestroyed()) {
    profileWindow.destroy();
    profileWindow = null;
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    applyLockScreenMode(mainWindow);
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send('lock-screen-reset');
  }
});

// IPC handler: renderer asks for the student token stored in the main process
ipcMain.handle('get-student-token', () => {
  return getStudentToken();
});

// IPC handler for student login (for browser monitoring)
ipcMain.handle('student-logged-in', async (_event, studentData: Record<string, unknown>) => {
  await resolveGatewayIp();
  const monitoringReady =
    studentData !== null &&
    typeof studentData === 'object' &&
    studentData.monitoringReady === true;
  if (monitoringReady) {
    studentSessionActive = true;
    lockScreenEnforced = false;
    if (!monitoringReadyStickyIso) {
      monitoringReadyStickyIso = new Date().toISOString();
    }
  }

  const desktopHeartbeat: Record<string, string> = {
    app_version: app.getVersion(),
    electron_version: String(process.versions.electron ?? ''),
    platform: process.platform,
  };
  if (monitoringReady && monitoringReadyStickyIso) {
    desktopHeartbeat.monitoring_ready_at = monitoringReadyStickyIso;
  }

  setStudentCredentials({
    email: studentData.email,
    token: studentData.token,
    userId: studentData.userId,
    fullName: studentData.fullName,
    computerName: COMPUTER_NAME,
    gatewayIp: GATEWAY_IP,
    desktopHeartbeat,
  });
});

ipcMain.handle('desktop-screen-changed', (_event, screen: unknown) => {
  const label = typeof screen === 'string' ? screen.slice(0, 64) : 'unknown';
  mergeDesktopHeartbeatFields({
    current_screen: label,
    screen_entered_at: new Date().toISOString(),
  });
});

// IPC handler for student logout (for browser monitoring)
ipcMain.handle('student-logged-out', () => {
  monitoringReadyStickyIso = null;
  studentSessionActive = false;
  quizActive = false;
  remoteLockActive = false;
  clearStudentCredentials();
});

// Student pressed "Return to desktop" on the quiz result screen — release the lock.
ipcMain.handle('quiz-dismiss', () => {
  quizActive = false;
  if (!studentSessionActive) return; // still on login/PIN screen: keep the window as is
  if (presentationActive || remoteLockActive) return; // other overlays still own the screen
  if (profileWindow && !profileWindow.isDestroyed()) {
    profileWindow.show();
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide();
  }
});

ipcMain.handle('quit-app', () => {
  allowAppQuit = true;
  if (profileWindow) {
    profileWindow.destroy();
    profileWindow = null;
  }
  app.quit();
});

ipcMain.handle('set-api-base-url', (_event, url: unknown) => {
  if (typeof url === 'string' && url.trim()) {
    const normalized = normalizeApiBaseUrl(url);
    setApiBaseUrl(normalized);
    console.log(`🌐 API Base URL updated via UI: ${normalized}`);
  }
  return true;
});

// This method will be called when Electron has finished initialization
app.on('ready', async () => {
  createWindow();
  await resolveGatewayIp();
  setComputerName(COMPUTER_NAME); // Set the hostname for the monitoring server
  setApiBaseUrl(API_BASE_URL);    // Set the API URL for heartbeats
  startMonitoringServer(); // Start monitoring server on port 9876

  // Register PC lock state callback — fires whenever heartbeat lock state changes
  registerLockStateCallback((isLocked: boolean, message: string | null) => {
    remoteLockActive = isLocked;
    if (!mainWindow || mainWindow.isDestroyed()) return;

    if (isLocked) {
      console.log('🔒 PC locked remotely — showing lock overlay');
      // Ensure window is on top and focused so lock overlay is fully visible
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
      mainWindow.show();
      mainWindow.focus();
      // Hide profile window so it does not float over the lock screen
      if (profileWindow && !profileWindow.isDestroyed()) {
        profileWindow.hide();
      }
      mainWindow.webContents.send('pc-locked', message ?? 'This PC has been locked by your instructor.');
    } else {
      console.log('🔓 PC unlocked remotely — hiding lock overlay');
      mainWindow.setAlwaysOnTop(false);
      mainWindow.webContents.send('pc-unlocked');
      if (!quizActive && !presentationActive && profileWindow && !profileWindow.isDestroyed()) {
        profileWindow.show();
      }
      // Return student to desktop if they are in an active session
      if (!quizActive && !presentationActive && studentSessionActive && !mainWindow.isDestroyed()) {
        mainWindow.hide();
      }
    }
  });

  // Register Screen Share Presentation callback — fires whenever professor starts/stops sharing
  registerPresentationStateCallback(
    (
      isPresenting: boolean,
      data: {
        sessionUuid: string | null;
        teacherName: string | null;
        subjectName: string | null;
      }
    ) => {
      presentationActive = isPresenting;
      if (!mainWindow || mainWindow.isDestroyed()) return;

      if (isPresenting && data?.sessionUuid) {
        console.log('📡 Live presentation started remotely:', data.sessionUuid, 'by', data.teacherName);
        // If main window was hidden (student in session), bring it back so presentation overlay is visible
        if (!mainWindow.isVisible()) {
          mainWindow.show();
          mainWindow.focus();
        }
        // Hide the profile overlay window so it doesn't float on top of the presentation
        if (profileWindow && !profileWindow.isDestroyed()) {
          profileWindow.hide();
        }
        // Include the student token in the payload so the renderer can authenticate API calls
        const token = getStudentToken();
        mainWindow.webContents.send('presentation-start', { ...data, token });
      } else {
        console.log('📡 Live presentation ended remotely');
        mainWindow.webContents.send('presentation-end');
        // Restore the profile overlay window after presentation ends (unless a quiz or lock owns the screen)
        if (!quizActive && !remoteLockActive && profileWindow && !profileWindow.isDestroyed()) {
          profileWindow.show();
        }
        // If student is logged in and not remotely locked, hide the main window so they return to their normal desktop
        if (!quizActive && studentSessionActive && !remoteLockActive && !mainWindow.isDestroyed()) {
          mainWindow.hide();
        }
      }
    }
  );

  // Register Quiz callback — fires when the professor launches a quiz for this student, or it stops being active.
  registerQuizStateCallback(
    (
      isActive: boolean,
      data: {
        quizId: number;
        title: string;
        subjectName: string | null;
        timeLimitMinutes: number;
        totalQuestions: number;
      } | null
    ) => {
      if (isActive && data) {
        console.log('📝 Quiz started remotely:', data.quizId, data.title);
        quizActive = true;
        if (!mainWindow || mainWindow.isDestroyed()) return;

        // Hide the floating profile widget so nothing sits above the exam screen
        if (profileWindow && !profileWindow.isDestroyed()) {
          profileWindow.hide();
        }
        applyLockScreenMode(mainWindow);
        if (!mainWindow.isVisible()) {
          mainWindow.show();
        }
        mainWindow.focus();
        // The renderer's token is cleared on startup, so hand it over with the event
        mainWindow.webContents.send('quiz-start', { ...data, token: getStudentToken() });
      } else {
        console.log('📝 Quiz no longer active on server');
        // Do NOT release the lock here: the renderer shows the result / "quiz ended" screen
        // and calls quiz-dismiss when the student is ready to return to the desktop.
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('quiz-end');
        } else {
          quizActive = false;
        }
      }
    }
  );
});

app.on('before-quit', (event) => {
  if (isStudentExitBlocked() && (lockScreenEnforced || studentSessionActive)) {
    event.preventDefault();
  }
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (isStudentExitBlocked() && (lockScreenEnforced || studentSessionActive)) {
    return;
  }
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

