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

// Create Express server
const server = express();
server.use(cors());
server.use(express.json());

// Endpoint for Chrome Extension to get current student credentials
server.get('/monitoring-credentials', (req, res) => {
    if (currentStudentCredentials) {
        res.json({
            success: true,
            credentials: {
                ...currentStudentCredentials,
                computerName: computerName,  // Include hostname for lab tracking
                gatewayIp: gatewayIp,        // Include gateway IP for lab tracking
                apiBaseUrl: apiBaseUrl        // Tell the extension which backend to use
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

// ─── Direct heartbeat from Desktop App to backend ───────────────────────────
// This ensures the student appears online and computer_name is tracked
// even when Chrome/Extension is not running.
async function sendDirectHeartbeat() {
    if (!currentStudentCredentials || !currentStudentCredentials.token) {
        return; // No student logged in, skip
    }

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
                gateway_ip: gatewayIp
            })
        });

        if (response.ok) {
            console.log('💓 Desktop heartbeat sent (computer:', computerName, 'gateway:', gatewayIp, ')');
        } else {
            console.error('❌ Desktop heartbeat failed:', response.status);
        }
    } catch (error) {
        // Backend not reachable - this is fine, just skip
        console.error('❌ Desktop heartbeat error:', error.message);
    }
}

function startDirectHeartbeat() {
    // Stop any existing interval
    stopDirectHeartbeat();

    // Send first heartbeat immediately
    sendDirectHeartbeat();

    // Then send every 30 seconds (Chrome Extension sends every 5s, so this is backup)
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
// ─────────────────────────────────────────────────────────────────────────────

// Start server
const PORT = 9876;
let serverInstance = null;

function startMonitoringServer() {
    // Prevent multiple instances
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

// Update credentials when student logs in
function setStudentCredentials(studentData) {
    currentStudentCredentials = studentData;
    console.log('✅ Student logged in for monitoring:', studentData.email);
    if (studentData.computerName) {
        computerName = studentData.computerName;
        console.log('🖥️ Computer Name set from login:', computerName);
    }
    // Start sending heartbeats directly from Desktop App
    startDirectHeartbeat();
}

// Clear credentials when student logs out
function clearStudentCredentials() {
    currentStudentCredentials = null;
    logoutSignal++; // Increment signal so extension knows to logout
    // Stop sending heartbeats
    stopDirectHeartbeat();
    console.log('✅ Student logged out from monitoring (signal:', logoutSignal + ')');
}

// Set computer name (called from main.ts on startup)
function setComputerName(name) {
    computerName = name;
    console.log('🖥️ Computer Name set:', computerName);
}

// Set gateway IP (called from main.ts on startup and refresh)
function setGatewayIp(ip) {
    gatewayIp = ip || null;
    console.log('🌐 Gateway IP set:', gatewayIp || 'N/A');
}

// Set API base URL (called from main.ts, reads from .env)
function setApiBaseUrl(url) {
    if (url) {
        // Normalize: ensure it ends with /api
        apiBaseUrl = url.replace(/\/+$/, '') + '/api';
        console.log('🌐 API Base URL set:', apiBaseUrl);
    }
}

module.exports = {
    startMonitoringServer,
    setStudentCredentials,
    clearStudentCredentials,
    setComputerName,
    setGatewayIp,
    setApiBaseUrl
};
