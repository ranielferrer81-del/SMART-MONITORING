// monitoring-server.cjs - Local HTTP server for Chrome Extension communication
// Also sends direct heartbeats to the backend so computer tracking works without Chrome
const express = require('express');
const cors = require('cors');
const {
    setScreenCaptureContext,
    clearScreenCaptureContext,
    startScreenCaptureLoop,
    stopScreenCaptureLoop,
} = require('./screen-capture.cjs');

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

// --- PC Lock state ---
// Callback registered by main.ts to push IPC events to the renderer
let lockStateCallback = null;
// Track the last known lock state so we only fire the callback on changes
let currentLockState = { isLocked: false, message: null };

// --- Screen Share Presentation state ---
let presentationStateCallback = null;
let currentPresentationState = { isPresenting: false, sessionUuid: null, teacherName: null, subjectName: null };

// --- Quiz state ---
let quizStateCallback = null;
let currentQuizState = { isActive: false, quizId: null };


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
            const data = await response.json().catch(() => ({}));

            // --- Handle PC lock state from heartbeat response ---
            const isLocked = data.is_locked === true;
            const lockMessage = data.lock_message || null;
            if (isLocked !== currentLockState.isLocked || lockMessage !== currentLockState.message) {
                currentLockState = { isLocked, message: lockMessage };
                if (typeof lockStateCallback === 'function') {
                    lockStateCallback(isLocked, lockMessage);
                }
            }

            // --- Handle Live Presentation (Screen Share) state ---
            const isPresenting = data.is_presenting === true;
            const sessionUuid = data.presentation_session_uuid || null;
            const teacherName = data.presentation_teacher_name || null;
            const subjectName = data.presentation_subject_name || null;

            if (
                isPresenting !== currentPresentationState.isPresenting ||
                sessionUuid !== currentPresentationState.sessionUuid
            ) {
                currentPresentationState = { isPresenting, sessionUuid, teacherName, subjectName };
                if (typeof presentationStateCallback === 'function') {
                    presentationStateCallback(isPresenting, {
                        sessionUuid,
                        teacherName,
                        subjectName,
                    });
                }
            }

            // --- Handle active quiz (locks the student screen until submitted) ---
            const quiz = data.is_quiz_active === true && data.active_quiz ? data.active_quiz : null;
            const quizId = quiz ? Number(quiz.id) : null;
            if (quizId !== currentQuizState.quizId) {
                currentQuizState = { isActive: quizId !== null, quizId };
                if (typeof quizStateCallback === 'function') {
                    quizStateCallback(
                        quizId !== null,
                        quiz
                            ? {
                                quizId,
                                title: String(quiz.title || 'Quiz'),
                                subjectName: quiz.subject_name || null,
                                timeLimitMinutes: Number(quiz.time_limit_minutes || 0),
                                totalQuestions: Number(quiz.total_questions || 0),
                            }
                            : null
                    );
                }
            }
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
    // Fast 5-second interval for responsive lock and presentation transitions
    heartbeatInterval = setInterval(sendDirectHeartbeat, 5000);
    console.log('💓 Desktop direct heartbeat started (every 5s)');
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

    setScreenCaptureContext({
        apiBaseUrl: apiBaseUrl.replace(/\/api\/?$/i, ''),
        token: copy.token,
        computerName: computerName,
        gatewayIp: gatewayIp,
    });
    startScreenCaptureLoop();
}

function clearStudentCredentials() {
    currentStudentCredentials = null;
    logoutSignal++;
    resetDesktopHeartbeatFields();
    currentPresentationState = { isPresenting: false, sessionUuid: null, teacherName: null, subjectName: null };
    currentLockState = { isLocked: false, message: null };
    currentQuizState = { isActive: false, quizId: null };
    stopDirectHeartbeat();
    stopScreenCaptureLoop();
    clearScreenCaptureContext();
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

function registerLockStateCallback(cb) {
    lockStateCallback = typeof cb === 'function' ? cb : null;
}

function registerPresentationStateCallback(cb) {
    presentationStateCallback = typeof cb === 'function' ? cb : null;
}

function registerQuizStateCallback(cb) {
    quizStateCallback = typeof cb === 'function' ? cb : null;
}

/**
 * Returns the currently logged-in student's auth token, or null if not logged in.
 * Used by main.ts to inject the token into the renderer before the presentation overlay mounts.
 */
function getStudentToken() {
    return currentStudentCredentials ? (currentStudentCredentials.token || null) : null;
}

module.exports = {
    startMonitoringServer,
    setStudentCredentials,
    clearStudentCredentials,
    mergeDesktopHeartbeatFields,
    resetDesktopHeartbeatFields,
    setComputerName,
    setGatewayIp,
    setApiBaseUrl,
    registerLockStateCallback,
    registerPresentationStateCallback,
    registerQuizStateCallback,
    getStudentToken,
};
