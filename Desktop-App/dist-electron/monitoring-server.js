// monitoring-server.ts - Local HTTP server for Chrome Extension communication
import express from 'express';
import cors from 'cors';
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
    if (currentStudentCredentials) {
        res.json({
            success: true,
            credentials: currentStudentCredentials
        });
    }
    else {
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
export function startMonitoringServer() {
    server.listen(PORT, () => {
        console.log(`✅ Monitoring server running on http://localhost:${PORT}`);
    });
}
// Update credentials when student logs in
export function setStudentCredentials(studentData) {
    currentStudentCredentials = studentData;
    console.log('✅ Student logged in for monitoring:', studentData.email);
}
// Clear credentials when student logs out
export function clearStudentCredentials() {
    currentStudentCredentials = null;
    logoutSignal++; // Increment signal so extension knows to logout
    console.log('✅ Student logged out from monitoring (signal:', logoutSignal + ')');
}
