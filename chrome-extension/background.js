// Configuration
// Default API URL (used when Desktop App is not running or hasn't provided one)
const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8000/api';
const DESKTOP_APP_URL = 'http://localhost:9876';

// Dynamic API URL - updated from Desktop App credentials
let dynamicApiBaseUrl = null;

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

// Poll Desktop App for student credentials every 5 seconds
function startDesktopAppPolling() {
    console.log('Starting Desktop App polling...');

    setInterval(async () => {
        try {
            // Check if already logged in
            const result = await chrome.storage.local.get([STORAGE_KEYS.TOKEN, STORAGE_KEYS.MANUAL_LOGOUT]);

            if (result[STORAGE_KEYS.TOKEN]) {
                return; // Already logged in, skip polling
            }

            // [BUG FIX] MODIFIED BY ANTIGRAVITY
            // The following check was preventing the extension from detecting a NEW student login
            // if a previous user had manually logged out. We want the Desktop App to be the
            // "Source of Truth" - if the app says someone is logged in, we should sync with it.
            /* 
            // CHECK: If user manually logged out, DO NOT auto-login
            if (result[STORAGE_KEYS.MANUAL_LOGOUT]) {
                // console.log('⏸️ User manually logged out. Skipping auto-login.');
                return;
            }
            */

            // Check Desktop App for credentials
            const response = await fetch(`${DESKTOP_APP_URL}/monitoring-credentials`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();

                if (data.success && data.credentials) {
                    console.log('✅ Desktop App credentials detected! Auto-logging in...');
                    await autoLoginWithDesktopApp(data.credentials);
                }
            }
        } catch (error) {
            // Desktop App not running or not reachable - this is normal
        }
    }, 5000);
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

// Poll Desktop App for logout status every 3 seconds
function startLogoutStatusPolling() {
    console.log('Starting Desktop App logout status polling...');

    // Track connection failures to detect if Desktop App was closed
    let consecutiveFailures = 0;
    const MAX_FAILURES_BEFORE_LOGOUT = 5; // 5 * 3s = 15 seconds grace period

    const pollLogoutStatus = async () => {
        try {
            // Only check if currently logged in
            const result = await chrome.storage.local.get([STORAGE_KEYS.TOKEN, STORAGE_KEYS.LAST_LOGOUT_SIGNAL]);

            // Only poll if logged in (REMOVED AUTO_ACTIVATED CHECK)
            if (!result[STORAGE_KEYS.TOKEN]) {
                // console.log('⏸️ No token, skipping logout check');
                consecutiveFailures = 0; // Reset counter if not logged in
                return;
            }

            // console.log('🔍 Checking logout status...');

            // Check Desktop App logout status
            const response = await fetch(`${DESKTOP_APP_URL}/logout-status`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                // Connection successful - reset failure counter
                consecutiveFailures = 0;

                const data = await response.json();
                // console.log('📊 Logout check:', data);

                if (data.success) {
                    const lastKnownSignal = result[STORAGE_KEYS.LAST_LOGOUT_SIGNAL] || 0;

                    // Store initial signal on first check
                    if (lastKnownSignal === 0 && data.logoutSignal > 0) {
                        console.log('📝 Storing initial signal:', data.logoutSignal);
                        await chrome.storage.local.set({
                            [STORAGE_KEYS.LAST_LOGOUT_SIGNAL]: data.logoutSignal
                        });
                        return;
                    }

                    // If logout signal changed, Desktop App logged out
                    if (data.logoutSignal > lastKnownSignal) {
                        console.log('🔴 LOGOUT DETECTED! Signal:', lastKnownSignal, '→', data.logoutSignal);

                        // Auto-logout extension
                        await autoLogoutFromDesktopApp();
                    } else if (data.isLoggedOut && result[STORAGE_KEYS.TOKEN]) {
                        // Desktop App is logged out but extension still has token
                        console.log('🔴 Desktop App logged out, logging out extension...');
                        await autoLogoutFromDesktopApp();
                    }
                }
            } else {
                console.log('❌ Logout check failed:', response.status);
                // Don't count HTTP errors (like 500) as "App Closed", possibly just server error
                // but if 404/Connection Refused it might be thrown as error below
            }
        } catch (error) {
            // console.log('⚠️ Logout check error:', error.message);

            // If fetch failed (likely connection refused because App closed), increment counter
            consecutiveFailures++;
            console.log(`⚠️ Connection lost (${consecutiveFailures}/${MAX_FAILURES_BEFORE_LOGOUT})`);

            if (consecutiveFailures >= MAX_FAILURES_BEFORE_LOGOUT) {
                console.log('🔴 Desktop App unreachable for too long. Assuming closed. Logging out...');
                await autoLogoutFromDesktopApp();
                consecutiveFailures = 0; // Reset after logout
            }
        }
    };

    // Run immediately
    pollLogoutStatus();

    // Then run every 3 seconds
    setInterval(pollLogoutStatus, 3000);
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

// Heartbeat system - checks for commands every 5 seconds
function startHeartbeat() {
    chrome.alarms.create('heartbeat', { periodInMinutes: 0.0833 }); // 5 seconds = 0.0833 minutes
}

function stopHeartbeat() {
    chrome.alarms.clear('heartbeat');
}

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'heartbeat') {
        sendHeartbeat();
    }
});

async function sendHeartbeat() {
    console.log('💓 Heartbeat fired - checking for commands...');

    const result = await chrome.storage.local.get([
        STORAGE_KEYS.TOKEN,
        STORAGE_KEYS.IS_MONITORING,
        STORAGE_KEYS.USER,
        STORAGE_KEYS.COMPUTER_NAME
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
        await fetch(`${getApiBaseUrl()}/browser-activity/heartbeat`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${result[STORAGE_KEYS.TOKEN]}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                open_tabs: openTabs,
                computer_name: result[STORAGE_KEYS.COMPUTER_NAME] || null
            })
        });

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
                                    const matchingTabs = allTabs.filter(tab => tab.url === targetUrl);

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
