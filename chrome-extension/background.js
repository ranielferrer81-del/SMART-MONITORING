// Configuration
// Default API URL (used when Desktop App is not running or hasn't provided one)
const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8000/api';
const DESKTOP_APP_URL = 'http://localhost:9876';

// Dynamic API URL - updated from Desktop App credentials
let dynamicApiBaseUrl = null;

// MV3 service worker note:
// setInterval can be paused when the service worker is suspended.
// We use chrome.alarms as a persistent wake-up mechanism to keep auto-login reliable.
const ALARMS = {
    DESKTOP_POLL: 'sia_desktop_poll',
    LOGOUT_POLL: 'sia_logout_poll',
    KEEPALIVE: 'sia_keepalive'
};

// Get the current API base URL (prefers Desktop App's URL over default)
function getApiBaseUrl() {
    return dynamicApiBaseUrl || DEFAULT_API_BASE_URL;
}

// Storage keys
const STORAGE_KEYS = {
    TOKEN: 'auth_token',
    USER: 'user_data',
    SESSION_ID: 'session_id',
    IS_MONITORING: 'is_monitoring',
    AUTO_ACTIVATED: 'auto_activated',
    LAST_LOGOUT_SIGNAL: 'last_logout_signal',
    MANUAL_LOGOUT: 'manual_logout', // Flag to track manual logout
    COMPUTER_NAME: 'computer_name', // PC hostname for lab tracking
    GATEWAY_IP: 'gateway_ip',       // Default gateway IP for lab tracking
    API_BASE_URL: 'api_base_url'    // Dynamic API URL from Desktop App
};

// Track active tabs and their visit times
const tabVisits = new Map();

// Track if monitoring listeners are already set up
let monitoringListenersActive = false;

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
    console.log('SIA Student Activity Monitor installed');
    // Restore saved API URL
    const stored = await chrome.storage.local.get(STORAGE_KEYS.API_BASE_URL);
    if (stored[STORAGE_KEYS.API_BASE_URL]) {
        dynamicApiBaseUrl = stored[STORAGE_KEYS.API_BASE_URL];
        console.log('🌐 Restored API URL:', dynamicApiBaseUrl);
    }
    checkAuthStatus();
    startDesktopAppPolling();
    startLogoutStatusPolling();
});

// Start polling when browser starts (not just on install)
chrome.runtime.onStartup.addListener(async () => {
    console.log('SIA Student Activity Monitor started');
    // Restore saved API URL
    const stored = await chrome.storage.local.get(STORAGE_KEYS.API_BASE_URL);
    if (stored[STORAGE_KEYS.API_BASE_URL]) {
        dynamicApiBaseUrl = stored[STORAGE_KEYS.API_BASE_URL];
        console.log('🌐 Restored API URL:', dynamicApiBaseUrl);
    }
    checkAuthStatus();
    startDesktopAppPolling();
    startLogoutStatusPolling();
});

function ensureBackgroundAlarms() {
    // Chrome clamps alarms to a minimum (often 1 minute), but alarms still reliably WAKE the worker.
    // When woken, we do an immediate poll so auto-login doesn't depend on long-lived setIntervals.
    chrome.alarms.create(ALARMS.DESKTOP_POLL, { periodInMinutes: 0.4 }); // ~24s (may clamp)
    chrome.alarms.create(ALARMS.LOGOUT_POLL, { periodInMinutes: 0.4 });  // ~24s (may clamp)
    chrome.alarms.create(ALARMS.KEEPALIVE, { periodInMinutes: 0.4 });    // ~24s (may clamp)
}

async function pollDesktopAppOnce() {
    try {
        // Always ask Desktop App for credentials, but only re-sync when token/user changes.
        const result = await chrome.storage.local.get([STORAGE_KEYS.TOKEN, STORAGE_KEYS.USER]);
        const storedToken = result[STORAGE_KEYS.TOKEN];
        const storedUserId = result[STORAGE_KEYS.USER]?.id;

        const response = await fetch(`${DESKTOP_APP_URL}/monitoring-credentials`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) return;
        const data = await response.json();
        if (!data?.success || !data?.credentials?.token) return;

        const incomingToken = data.credentials.token;
        const incomingUserId = data.credentials.userId;

        // If extension already has the same token AND same user, do nothing.
        if (storedToken && storedToken === incomingToken && storedUserId && storedUserId === incomingUserId) {
            return;
        }

        console.log('✅ Desktop App credentials detected! Auto-logging in...');
        await autoLoginWithDesktopApp(data.credentials);
    } catch {
        // Desktop App not running or not reachable - normal
    }
}

// Poll Desktop App for student credentials (wake-safe)
function startDesktopAppPolling() {
    console.log('Starting Desktop App polling...');
    ensureBackgroundAlarms();
    // Do an immediate check (fast path)
    pollDesktopAppOnce();
}

// Auto-login using Desktop App credentials
async function autoLoginWithDesktopApp(credentials) {
    try {
        // Fetch current logout signal before logging in
        let currentLogoutSignal = 0;
        try {
            const statusResponse = await fetch(`${DESKTOP_APP_URL}/logout-status`);
            if (statusResponse.ok) {
                const statusData = await statusResponse.json();
                currentLogoutSignal = statusData.logoutSignal || 0;
                console.log('📝 Current logout signal:', currentLogoutSignal);
            }
        } catch (e) {
            console.log('Could not fetch initial logout signal');
        }

        // If Desktop App provided an API URL, use it
        if (credentials.apiBaseUrl) {
            dynamicApiBaseUrl = credentials.apiBaseUrl;
            console.log('🌐 Using API URL from Desktop App:', dynamicApiBaseUrl);
        }

        await chrome.storage.local.set({
            [STORAGE_KEYS.TOKEN]: credentials.token,
            [STORAGE_KEYS.USER]: {
                email: credentials.email,
                id: credentials.userId,
                full_name: credentials.fullName
            },
            [STORAGE_KEYS.IS_MONITORING]: true,
            [STORAGE_KEYS.AUTO_ACTIVATED]: true,
            [STORAGE_KEYS.LAST_LOGOUT_SIGNAL]: currentLogoutSignal,
            [STORAGE_KEYS.COMPUTER_NAME]: credentials.computerName || null,
            [STORAGE_KEYS.GATEWAY_IP]: credentials.gatewayIp || null,
            [STORAGE_KEYS.API_BASE_URL]: dynamicApiBaseUrl || DEFAULT_API_BASE_URL
        });

        // Ensure manual logout flag is cleared if it existed (though polling prevents getting here usually)
        await chrome.storage.local.remove(STORAGE_KEYS.MANUAL_LOGOUT);

        startMonitoring();

        console.log('✅ Auto-login successful! Monitoring started for:', credentials.email);

        // Show notification safely
        if (typeof chrome !== 'undefined' && chrome.notifications) {
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon48.png',
                title: 'Monitoring Activated',
                message: 'Browser monitoring started automatically for ' + credentials.fullName,
                priority: 1
            });
        }
    } catch (error) {
        console.error('Auto-login failed:', error);
    }
}

async function pollLogoutStatusOnce() {
    try {
        // Only check if currently logged in
        const result = await chrome.storage.local.get([STORAGE_KEYS.TOKEN, STORAGE_KEYS.LAST_LOGOUT_SIGNAL]);

        if (!result[STORAGE_KEYS.TOKEN]) {
            return;
        }

        const response = await fetch(`${DESKTOP_APP_URL}/logout-status`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
            return;
        }

        const data = await response.json();
        if (!data?.success) return;

        const lastKnownSignal = result[STORAGE_KEYS.LAST_LOGOUT_SIGNAL] || 0;

        // Store initial signal on first check
        if (lastKnownSignal === 0 && data.logoutSignal > 0) {
            console.log('📝 Storing initial signal:', data.logoutSignal);
            await chrome.storage.local.set({ [STORAGE_KEYS.LAST_LOGOUT_SIGNAL]: data.logoutSignal });
            return;
        }

        // If logout signal changed, Desktop App logged out
        if (data.logoutSignal > lastKnownSignal) {
            console.log('🔴 LOGOUT DETECTED! Signal:', lastKnownSignal, '→', data.logoutSignal);
            await autoLogoutFromDesktopApp();
            return;
        }

        if (data.isLoggedOut && result[STORAGE_KEYS.TOKEN]) {
            console.log('🔴 Desktop App logged out, logging out extension...');
            await autoLogoutFromDesktopApp();
        }
    } catch {
        // If Desktop App is unreachable, we don't force logout immediately here.
        // The next alarm ticks will keep checking, and the user can still be logged-in on the backend.
    }
}

// Poll Desktop App for logout status (wake-safe)
function startLogoutStatusPolling() {
    console.log('Starting Desktop App logout status polling...');
    ensureBackgroundAlarms();
    pollLogoutStatusOnce();
}

// Auto-logout when Desktop App logs out
async function autoLogoutFromDesktopApp() {
    try {
        console.log('🔴 Auto-logout triggered by Desktop App');

        // Stop monitoring
        stopMonitoring();
        stopHeartbeat();

        // Clear all storage
        await chrome.storage.local.clear();

        // Clear tab visits
        tabVisits.clear();

        // Show notification
        if (typeof chrome !== 'undefined' && chrome.notifications) {
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon48.png',
                title: 'Monitoring Stopped',
                message: 'Connection to Desktop App lost. Monitoring stopped.',
                priority: 2
            });
        }

        console.log('✅ Extension logged out successfully');
    } catch (error) {
        console.error('Auto-logout failed:', error);
    }
}

// Check if user is authenticated
async function checkAuthStatus() {
    const result = await chrome.storage.local.get([STORAGE_KEYS.TOKEN, STORAGE_KEYS.USER]);
    if (result[STORAGE_KEYS.TOKEN] && result[STORAGE_KEYS.USER]) {
        console.log('User authenticated:', result[STORAGE_KEYS.USER]);
        startMonitoring();
    } else {
        console.log('User not authenticated');
    }
}

// Start monitoring browser activity
function startMonitoring() {
    // Prevent adding duplicate listeners
    if (monitoringListenersActive) {
        console.log('Monitoring already active, skipping listener setup');
        return;
    }

    console.log('Starting browser activity monitoring');
    startHeartbeat();
    sendHeartbeat(); // Send immediate heartbeat

    // Add listeners
    chrome.tabs.onUpdated.addListener(handleTabUpdate);
    chrome.tabs.onActivated.addListener(handleTabActivated);
    chrome.tabs.onRemoved.addListener(handleTabRemoved);
    chrome.webNavigation.onCompleted.addListener(handleNavigation);
    chrome.tabs.onCreated.addListener(handleTabCreated);

    monitoringListenersActive = true;
    console.log('✅ Monitoring listeners activated');
}

// Stop monitoring browser activity
function stopMonitoring() {
    if (!monitoringListenersActive) {
        return;
    }

    console.log('Stopping browser activity monitoring');

    // Remove listeners
    chrome.tabs.onUpdated.removeListener(handleTabUpdate);
    chrome.tabs.onActivated.removeListener(handleTabActivated);
    chrome.tabs.onRemoved.removeListener(handleTabRemoved);
    chrome.webNavigation.onCompleted.removeListener(handleNavigation);
    chrome.tabs.onCreated.removeListener(handleTabCreated);

    monitoringListenersActive = false;
    console.log('✅ Monitoring listeners deactivated');
}

// Handle tab updates
async function handleTabUpdate(tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete' && tab.url) {
        await logActivity(tab);
    }
}

// Handle tab activation
async function handleTabActivated(activeInfo) {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) {
        await logActivity(tab);
    }
}

// Handle tab removal
function handleTabRemoved(tabId) {
    if (tabVisits.has(tabId)) {
        tabVisits.delete(tabId);
    }
}

// Handle navigation completion
async function handleNavigation(details) {
    if (details.frameId === 0) {
        const tab = await chrome.tabs.get(details.tabId);
        await logActivity(tab);
    }
}

// Handle tab creation (detect incognito)
async function handleTabCreated(tab) {
    if (tab.incognito) {
        await logIncognitoAlert();
    }
}

// Log browsing activity to backend
async function logActivity(tab) {
    try {
        const result = await chrome.storage.local.get([
            STORAGE_KEYS.TOKEN,
            STORAGE_KEYS.USER,
            STORAGE_KEYS.IS_MONITORING
        ]);

        if (!result[STORAGE_KEYS.IS_MONITORING] || !result[STORAGE_KEYS.TOKEN]) {
            return;
        }

        if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
            return;
        }

        let duration = null;
        if (tabVisits.has(tab.id)) {
            const lastVisit = tabVisits.get(tab.id);
            duration = Math.floor((Date.now() - lastVisit) / 1000);
        }
        tabVisits.set(tab.id, Date.now());

        const activityData = {
            url: tab.url,
            page_title: tab.title || '',
            visit_timestamp: new Date().toISOString(),
            tab_id: tab.id.toString(),
            is_incognito: tab.incognito || false
        };

        if (duration !== null) {
            activityData.duration_seconds = duration;
        }

        console.log('📝 Logging activity:', tab.url);

        const response = await fetch(`${getApiBaseUrl()}/browser-activity/log`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${result[STORAGE_KEYS.TOKEN]}`,
                'Accept': 'application/json'
            },
            body: JSON.stringify(activityData)
        });

        if (!response.ok) {
            console.error('❌ Failed to log activity:', response.status, await response.text());
        } else {
            console.log('✅ Activity logged');
        }
    } catch (error) {
        console.error('❌ Error logging activity:', error);
    }
}

// Log incognito mode detection
async function logIncognitoAlert() {
    try {
        const result = await chrome.storage.local.get([STORAGE_KEYS.TOKEN]);

        if (!result[STORAGE_KEYS.TOKEN]) {
            return;
        }

        const response = await fetch(`${getApiBaseUrl()}/browser-activity/incognito-alert`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${result[STORAGE_KEYS.TOKEN]}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            console.error('Failed to log incognito alert:', await response.text());
        } else {
            console.log('Incognito alert logged');
            // Show notification safely
            if (typeof chrome !== 'undefined' && chrome.notifications) {
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'icons/icon48.png',
                    title: 'Incognito Mode Detected',
                    message: 'Your teacher has been notified that you opened an incognito window.',
                    priority: 2
                });
            }
        }
    } catch (error) {
        console.error('Error logging incognito alert:', error);
    }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'login') {
        handleLogin(request.data).then(sendResponse);
        return true;
    } else if (request.action === 'logout') {
        handleLogout().then(sendResponse);
        return true;
    } else if (request.action === 'getStatus') {
        getMonitoringStatus().then(sendResponse);
        return true;
    } else if (request.action === 'startMonitoring') {
        chrome.storage.local.set({ [STORAGE_KEYS.IS_MONITORING]: true });
        startMonitoring();
        sendResponse({ success: true });
    } else if (request.action === 'stopMonitoring') {
        chrome.storage.local.set({ [STORAGE_KEYS.IS_MONITORING]: false });
        stopHeartbeat();
        sendResponse({ success: true });
    }
});

// Handle login
async function handleLogin(credentials) {
    try {
        const response = await fetch(`${getApiBaseUrl()}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(credentials)
        });

        const data = await response.json();

        if (response.ok && data.token) {
            // Save token and info
            await chrome.storage.local.set({
                [STORAGE_KEYS.TOKEN]: data.token,
                [STORAGE_KEYS.USER]: data.user,
                [STORAGE_KEYS.IS_MONITORING]: true
            });

            // CLEAR THE MANUAL LOGOUT FLAG on successful login
            await chrome.storage.local.remove(STORAGE_KEYS.MANUAL_LOGOUT);

            startMonitoring();
            return { success: true, user: data.user };
        } else {
            return { success: false, error: data.error || 'Login failed' };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Handle logout
async function handleLogout() {
    stopMonitoring();
    stopHeartbeat();

    // Clear storage BUT set the MANUAL_LOGOUT flag
    await chrome.storage.local.clear();
    await chrome.storage.local.set({ [STORAGE_KEYS.MANUAL_LOGOUT]: true });

    tabVisits.clear();
    return { success: true };
}

// Get monitoring status
async function getMonitoringStatus() {
    const result = await chrome.storage.local.get([
        STORAGE_KEYS.TOKEN,
        STORAGE_KEYS.USER,
        STORAGE_KEYS.IS_MONITORING
    ]);

    return {
        isAuthenticated: !!result[STORAGE_KEYS.TOKEN],
        isMonitoring: result[STORAGE_KEYS.IS_MONITORING] || false,
        user: result[STORAGE_KEYS.USER] || null
    };
}

// Heartbeat system - uses setInterval for reliable 5-second polling
// NOTE: chrome.alarms has a minimum of 1 minute in MV3, so we use setInterval instead.
let heartbeatIntervalId = null;

function startHeartbeat() {
    // Clear any existing interval first
    stopHeartbeat();
    // Send heartbeat every 5 seconds using setInterval (not chrome.alarms)
    heartbeatIntervalId = setInterval(() => {
        sendHeartbeat();
    }, 5000);
    console.log('💓 Heartbeat started (setInterval, every 5s)');
    // Keep the service worker alive so setInterval keeps firing
    keepServiceWorkerAlive();
}

function stopHeartbeat() {
    if (heartbeatIntervalId) {
        clearInterval(heartbeatIntervalId);
        heartbeatIntervalId = null;
        console.log('💓 Heartbeat stopped');
    }
    // Do not clear alarms here: alarms are also used to reliably wake the MV3 worker
    // for Desktop App auto-login + logout detection even when not monitoring.
}

// Keep the MV3 service worker alive by creating a long-lived alarm
// This prevents Chrome from killing the service worker while monitoring is active
function keepServiceWorkerAlive() {
    ensureBackgroundAlarms();
}

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARMS.DESKTOP_POLL) {
        pollDesktopAppOnce();
        return;
    }
    if (alarm.name === ALARMS.LOGOUT_POLL) {
        pollLogoutStatusOnce();
        return;
    }
    if (alarm.name === ALARMS.KEEPALIVE) {
        // Wake-up tick:
        // - try to auto-login if desktop app has credentials
        // - restart heartbeat if Chrome cleared the interval while monitoring is active
        pollDesktopAppOnce();
        pollLogoutStatusOnce();

        if (heartbeatIntervalId === null) {
            chrome.storage.local.get([STORAGE_KEYS.TOKEN, STORAGE_KEYS.IS_MONITORING], (result) => {
                if (result[STORAGE_KEYS.TOKEN] && result[STORAGE_KEYS.IS_MONITORING]) {
                    console.log('🔄 Restarting heartbeat after keepalive wake');
                    heartbeatIntervalId = setInterval(() => {
                        sendHeartbeat();
                    }, 5000);
                    sendHeartbeat();
                }
            });
        }
    }
});

async function sendHeartbeat() {
    console.log('💓 Heartbeat fired - checking for commands...');

    const result = await chrome.storage.local.get([
        STORAGE_KEYS.TOKEN,
        STORAGE_KEYS.IS_MONITORING,
        STORAGE_KEYS.USER,
        STORAGE_KEYS.COMPUTER_NAME,
        STORAGE_KEYS.GATEWAY_IP
    ]);

    if (!result[STORAGE_KEYS.TOKEN] || !result[STORAGE_KEYS.IS_MONITORING]) {
        console.log('⏸️ Heartbeat skipped - not monitoring');
        return;
    }

    try {
        // Get all currently open tabs
        let openTabs = [];
        try {
            const allTabs = await chrome.tabs.query({});
            openTabs = allTabs
                .filter(tab => tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://'))
                .map(tab => ({
                    tab_id: tab.id,
                    url: tab.url,
                    title: tab.title || 'Untitled',
                    is_incognito: tab.incognito || false
                }));
        } catch (error) {
            console.error('Failed to get open tabs:', error);
        }

        // Send heartbeat with currently open tabs and computer name
        const heartbeatResponse = await fetch(`${getApiBaseUrl()}/browser-activity/heartbeat`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${result[STORAGE_KEYS.TOKEN]}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                open_tabs: openTabs,
                computer_name: result[STORAGE_KEYS.COMPUTER_NAME] || null,
                gateway_ip: result[STORAGE_KEYS.GATEWAY_IP] || null
            })
        });

        if (heartbeatResponse.status === 401) {
            console.log('🔴 Token revoked (401). Immediately logging out extension...');
            await autoLogoutFromDesktopApp();
            return;
        }

        // Check for force-close commands
        if (result[STORAGE_KEYS.USER] && result[STORAGE_KEYS.USER].id) {
            console.log('🔍 Checking for close commands for student:', result[STORAGE_KEYS.USER].id);

            const activityResponse = await fetch(`${getApiBaseUrl()}/browser-activity/student/${result[STORAGE_KEYS.USER].id}?per_page=5`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${result[STORAGE_KEYS.TOKEN]}`,
                    'Accept': 'application/json'
                }
            });

            if (activityResponse.ok) {
                const activityData = await activityResponse.json();
                console.log('📥 Fetched activities:', activityData.data?.length || 0);

                if (activityData && activityData.data && activityData.data.length > 0) {
                    // Log all URLs to see what we got
                    console.log('📋 Activity URLs:', activityData.data.map(a => a.url));

                    // Check for browser close command
                    const browserCloseCmd = activityData.data.find(a => a.url === 'FORCE_CLOSE_COMMAND');
                    if (browserCloseCmd) {
                        console.log('🔴 FORCE CLOSE BROWSER! Closing all windows...');

                        if (typeof chrome !== 'undefined' && chrome.notifications) {
                            chrome.notifications.create({
                                type: 'basic',
                                iconUrl: 'icons/icon48.png',
                                title: 'Browser Closing',
                                message: 'Your teacher has requested to close your browser.',
                                priority: 2
                            });
                        }

                        // Tell backend we saw the commands so they don't loop
                        await fetch(`${getApiBaseUrl()}/browser-activity/clear-commands`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${result[STORAGE_KEYS.TOKEN]}`,
                                'Accept': 'application/json'
                            }
                        });

                        await new Promise(resolve => setTimeout(resolve, 2000));

                        const windows = await chrome.windows.getAll();
                        for (const window of windows) {
                            await chrome.windows.remove(window.id);
                        }
                        return;
                    }

                    // Check for tab close commands
                    const tabCloseCommands = activityData.data.filter(a => a.url === 'FORCE_CLOSE_TAB_COMMAND');
                    console.log('🔍 Found', tabCloseCommands.length, 'tab close commands');

                    if (tabCloseCommands.length > 0) {
                        for (const cmd of tabCloseCommands) {
                            // The target URL is stored in page_title
                            const targetUrl = cmd.page_title;
                            if (targetUrl) {
                                try {
                                    console.log(`🔴 FORCE CLOSE TAB! Looking for URL: ${targetUrl}`);

                                    // Get all tabs and find ones matching the URL
                                    const allTabs = await chrome.tabs.query({});
                                    // Normalize URLs for comparison (strip trailing slash)
                                    const normalizeUrl = (u) => u ? u.replace(/\/+$/, '') : '';
                                    const normalizedTarget = normalizeUrl(targetUrl);
                                    const matchingTabs = allTabs.filter(tab => {
                                        const normalizedTab = normalizeUrl(tab.url);
                                        return normalizedTab === normalizedTarget ||
                                            normalizedTab.startsWith(normalizedTarget) ||
                                            normalizedTarget.startsWith(normalizedTab);
                                    });

                                    if (matchingTabs.length > 0) {
                                        for (const tab of matchingTabs) {
                                            await chrome.tabs.remove(tab.id);
                                            console.log(`✅ Tab closed: ${tab.url} (ID: ${tab.id})`);
                                        }
                                    } else {
                                        console.log(`⚠️ No tabs found with URL: ${targetUrl}`);
                                    }
                                } catch (error) {
                                    console.log(`⚠️ Error closing tab:`, error.message);
                                }
                            }
                        }

                        // Tell backend we saw the commands so they don't loop
                        await fetch(`${getApiBaseUrl()}/browser-activity/clear-commands`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${result[STORAGE_KEYS.TOKEN]}`,
                                'Accept': 'application/json'
                            }
                        });
                    }
                }
            } else {
                console.error('❌ Activity fetch failed! Status:', activityResponse.status, activityResponse.statusText);
                const errorText = await activityResponse.text();
                console.error('❌ Error response:', errorText);
            }
        }
    } catch (error) {
        console.error('❌ Heartbeat failed:', error.message);
    }
}
