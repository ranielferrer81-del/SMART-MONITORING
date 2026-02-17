// monitoring-server.js - Local HTTP server for Chrome Extension communication
const express = require('express');
const cors = require('cors');

// Store logged-in student credentials
let currentStudentCredentials = null;
// Track logout signal - incremented each time student logs out
let logoutSignal = 0;

// Create Express server
const server = express();
server.use(cors());
server.use(express.json());

// Endpoint for Chrome Extension to get current student credentials
server.get('/monitoring-credentials', (req, res) => {
    console.log('📡 Extension polling for credentials...', currentStudentCredentials ? 'FOUND' : 'NONE');
    if (currentStudentCredentials) {
        res.json({
            success: true,
            credentials: currentStudentCredentials
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
}

// Clear credentials when student logs out
function clearStudentCredentials() {
    currentStudentCredentials = null;
    logoutSignal++; // Increment signal so extension knows to logout
    console.log('✅ Student logged out from monitoring (signal:', logoutSignal + ')');
}

module.exports = {
    startMonitoringServer,
    setStudentCredentials,
    clearStudentCredentials
};
