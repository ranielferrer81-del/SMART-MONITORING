// monitoring-server.cjs - Local HTTP server for Chrome Extension communication
// Also sends direct heartbeats to the backend so computer tracking works without Chrome
const express = require('express');
const cors = require('cors');

// Backend API URL - set dynamically from main.ts (reads Desktop App .env)
let apiBaseUrl = 'http://127.0.0.1:8000/api';

// Store logged-in student credentials
let currentStudentCredentials = null;
// Track logout signal - incremented each time student logs out
let logoutSignal = 0;
// Store the computer hostname for lab tracking
let computerName = null;
// Store network gateway IP for lab resolution
let gatewayIp = null;
// Heartbeat interval reference
let heartbeatInterval = null;

// Merged into POST /browser-activity/heartbeat as JSON key "desktop" (not exposed to Chrome extension credential API)
let desktopHeartbeatFields = {};

// Create Express server
const server = express();
server.use(cors());
server.use(express.json());

// Endpoint for Chrome Extension to get current student credentials
server.get('/monitoring-credentials', (req, res) => {
    if (currentStudentCredentials) {
        const { desktopHeartbeat: _omit, ...rest } =
            typeof currentStudentCredentials === 'object' && currentStudentCredentials !== null
                ? currentStudentCredentials
                : {};
        res.json({
            success: true,
            credentials: {
                ...rest,
                computerName: computerName,
                gatewayIp: gatewayIp,
                apiBaseUrl: apiBaseUrl
            }
        });
    } else {
        res.json({
            success: false,
            message: 'No student logged in'
        });
    }
});

// Endpoint for Chrome Extension to check logout status
server.get('/logout-status', (req, res) => {
    res.json({
        success: true,
        logoutSignal: logoutSignal,
        isLoggedOut: currentStudentCredentials === null
    });
});

function resetDesktopHeartbeatFields() {
    desktopHeartbeatFields = {};
}

function mergeDesktopHeartbeatFields(partial) {
    if (!partial || typeof partial !== 'object') {
        return;
    }
    desktopHeartbeatFields = { ...desktopHeartbeatFields, ...partial };
}

// ─── Direct heartbeat from Desktop App to backend ───────────────────────────
async function sendDirectHeartbeat() {
    if (!currentStudentCredentials || !currentStudentCredentials.token) {
        return;
    }

    const desktop = {
        ...desktopHeartbeatFields,
        client_reported_at: new Date().toISOString()
    };

    try {
        const response = await fetch(`${apiBaseUrl}/browser-activity/heartbeat`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentStudentCredentials.token}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                computer_name: computerName,
                gateway_ip: gatewayIp,
                desktop
            })
        });

        if (response.ok) {
            console.log('💓 Desktop heartbeat sent (computer:', computerName, 'gateway:', gatewayIp, ')');
        } else {
            console.error('❌ Desktop heartbeat failed:', response.status);
        }
    } catch (error) {
        console.error('❌ Desktop heartbeat error:', error.message);
    }
}

function startDirectHeartbeat() {
    stopDirectHeartbeat();
    sendDirectHeartbeat();
    heartbeatInterval = setInterval(sendDirectHeartbeat, 30000);
    console.log('💓 Desktop direct heartbeat started (every 30s)');
}

function stopDirectHeartbeat() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
        console.log('💓 Desktop direct heartbeat stopped');
    }
}

const PORT = 9876;
let serverInstance = null;

function startMonitoringServer() {
    if (serverInstance) {
        console.log('⚠️ Monitoring server already running');
        return;
    }

    try {
        serverInstance = server.listen(PORT, '127.0.0.1', () => {
            console.log(`✅ Monitoring server running on http://localhost:${PORT}`);
            console.log(`🌐 API URL: ${apiBaseUrl}`);
            if (computerName) {
                console.log(`🖥️ Computer Name: ${computerName}`);
            }
        });

        serverInstance.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.error(`❌ Port ${PORT} is already in use! Another instance may be running.`);
                serverInstance = null;
            } else {
                console.error('❌ Monitoring server error:', error);
            }
        });
    } catch (error) {
        console.error('❌ Failed to start monitoring server:', error);
        serverInstance = null;
    }
}

function setStudentCredentials(studentData) {
    resetDesktopHeartbeatFields();
    const copy = typeof studentData === 'object' && studentData !== null ? { ...studentData } : {};
    const heartbeat = copy.desktopHeartbeat;
    delete copy.desktopHeartbeat;
    currentStudentCredentials = copy;

    console.log('✅ Student logged in for monitoring:', copy.email);
    if (copy.computerName) {
        computerName = copy.computerName;
        console.log('🖥️ Computer Name set from login:', computerName);
    }
    if (heartbeat && typeof heartbeat === 'object') {
        mergeDesktopHeartbeatFields(heartbeat);
    }

    startDirectHeartbeat();
}

function clearStudentCredentials() {
    currentStudentCredentials = null;
    logoutSignal++;
    resetDesktopHeartbeatFields();
    stopDirectHeartbeat();
    console.log('✅ Student logged out from monitoring (signal:', logoutSignal + ')');
}

function setComputerName(name) {
    computerName = name;
    console.log('🖥️ Computer Name set:', computerName);
}

function setGatewayIp(ip) {
    gatewayIp = ip || null;
    console.log('🌐 Gateway IP set:', gatewayIp || 'N/A');
}

function setApiBaseUrl(url) {
    if (!url) return;
    let base = String(url).trim().replace(/\/+$/, '');
    if (!/\/api$/i.test(base)) {
        base = base + '/api';
    }
    apiBaseUrl = base;
    console.log('🌐 API Base URL set:', apiBaseUrl);
}

module.exports = {
    startMonitoringServer,
    setStudentCredentials,
    clearStudentCredentials,
    mergeDesktopHeartbeatFields,
    resetDesktopHeartbeatFields,
    setComputerName,
    setGatewayIp,
    setApiBaseUrl
};
