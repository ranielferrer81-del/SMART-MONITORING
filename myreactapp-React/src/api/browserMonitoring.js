import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://127.0.0.1:8000/api';

// Get auth token from localStorage
const getAuthToken = () => {
    return localStorage.getItem('token');
};

// Get browser activity for a specific student
export const getStudentBrowserActivity = async (studentId, filters = {}) => {
    try {
        const token = getAuthToken();
        const params = new URLSearchParams(filters).toString();
        const url = `${API_BASE}/browser-activity/student/${studentId}${params ? `?${params}` : ''}`;

        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });

        return { ok: true, data: response.data };
    } catch (error) {
        return {
            ok: false,
            error: error.response?.data?.message || error.message
        };
    }
};

// Get student's currently open tabs
export const getStudentOpenTabs = async (studentId) => {
    try {
        const token = getAuthToken();
        const response = await axios.get(`${API_BASE}/browser-activity/student/${studentId}/open-tabs`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });
        return { ok: true, data: response.data };
    } catch (error) {
        return {
            ok: false,
            error: error.response?.data?.message || error.message
        };
    }
};

// Get real-time browser activity feed
export const getRealtimeBrowserActivity = async () => {
    try {
        const token = getAuthToken();
        const response = await axios.get(`${API_BASE}/browser-activity/realtime`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });

        return { ok: true, data: response.data };
    } catch (error) {
        return {
            ok: false,
            error: error.response?.data?.message || error.message
        };
    }
};

// Get incognito alerts
export const getIncognitoAlerts = async (filters = {}) => {
    try {
        const token = getAuthToken();
        const params = new URLSearchParams(filters).toString();
        const url = `${API_BASE}/browser-activity/incognito-alerts${params ? `?${params}` : ''}`;

        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });

        return { ok: true, data: response.data };
    } catch (error) {
        return {
            ok: false,
            error: error.response?.data?.message || error.message
        };
    }
};

// Acknowledge an incognito alert
export const acknowledgeIncognitoAlert = async (alertId) => {
    try {
        const token = getAuthToken();
        const response = await axios.patch(
            `${API_BASE}/browser-activity/incognito-alerts/${alertId}/acknowledge`,
            {},
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            }
        );

        return { ok: true, data: response.data };
    } catch (error) {
        return {
            ok: false,
            error: error.response?.data?.message || error.message
        };
    }
};

// Start a monitoring session
export const startMonitoringSession = async (studentUserId, sessionName = '') => {
    try {
        const token = getAuthToken();
        const response = await axios.post(
            `${API_BASE}/monitoring-sessions/start`,
            { student_user_id: studentUserId, session_name: sessionName },
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            }
        );

        return { ok: true, data: response.data };
    } catch (error) {
        return {
            ok: false,
            error: error.response?.data?.message || error.message
        };
    }
};

// End a monitoring session
export const endMonitoringSession = async (sessionId) => {
    try {
        const token = getAuthToken();
        const response = await axios.post(
            `${API_BASE}/monitoring-sessions/${sessionId}/end`,
            {},
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            }
        );

        return { ok: true, data: response.data };
    } catch (error) {
        return {
            ok: false,
            error: error.response?.data?.message || error.message
        };
    }
};

// Get all monitoring sessions
export const getMonitoringSessions = async (filters = {}) => {
    try {
        const token = getAuthToken();
        const params = new URLSearchParams(filters).toString();
        const url = `${API_BASE}/monitoring-sessions${params ? `?${params}` : ''}`;

        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });

        return { ok: true, data: response.data };
    } catch (error) {
        return {
            ok: false,
            error: error.response?.data?.message || error.message
        };
    }
};
// Get list of online students
export const getOnlineStudents = async () => {
    try {
        const token = getAuthToken();
        const response = await axios.get(`${API_BASE}/browser-activity/online-students`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });

        return { ok: true, data: response.data };
    } catch (error) {
        return {
            ok: false,
            error: error.response?.data?.message || error.message
        };
    }
};

// Force close student browser
export const forceCloseStudentBrowser = async (studentId) => {
    try {
        const token = getAuthToken();
        const response = await axios.post(
            `${API_BASE}/browser-activity/force-close/${studentId}`,
            {},
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            }
        );

        return { ok: true, data: response.data };
    } catch (error) {
        return {
            ok: false,
            error: error.response?.data?.message || error.message
        };
    }
};

// Force close specific student tab and delete history
export const forceCloseStudentTab = async (studentId, activityId, url) => {
    try {
        const token = getAuthToken();
        const response = await axios.post(
            `${API_BASE}/browser-activity/force-close-tab/${studentId}`,
            { activity_id: activityId, url: url },
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            }
        );

        return { ok: true, data: response.data };
    } catch (error) {
        return {
            ok: false,
            error: error.response?.data?.message || error.message
        };
    }
};
