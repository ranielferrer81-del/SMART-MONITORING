// DOM Elements
const loginForm = document.getElementById('loginForm');
const monitoringStatus = document.getElementById('monitoringStatus');
const loading = document.getElementById('loading');
const loginFormElement = document.getElementById('loginFormElement');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const statusIndicator = document.getElementById('statusIndicator');
const studentName = document.getElementById('studentName');
const studentEmail = document.getElementById('studentEmail');

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
    await checkStatus();
});

// Check monitoring status
async function checkStatus() {
    showLoading();

    try {
        const response = await chrome.runtime.sendMessage({ action: 'getStatus' });

        if (response.isAuthenticated) {
            showMonitoringStatus(response);
        } else {
            showLoginForm();
        }
    } catch (error) {
        console.error('Error checking status:', error);
        showLoginForm();
    }
}

// Show loading state
function showLoading() {
    loginForm.style.display = 'none';
    monitoringStatus.style.display = 'none';
    loading.style.display = 'block';
}

// Show login form
function showLoginForm() {
    loading.style.display = 'none';
    monitoringStatus.style.display = 'none';
    loginForm.style.display = 'block';
}

// Show monitoring status
function showMonitoringStatus(status) {
    loading.style.display = 'none';
    loginForm.style.display = 'none';
    monitoringStatus.style.display = 'block';

    // Update user info
    if (status.user) {
        studentName.textContent = status.user.full_name || 'N/A';
        studentEmail.textContent = status.user.email || 'N/A';
    }

    // Update status indicator
    if (status.isMonitoring) {
        statusIndicator.textContent = '● Active';
        statusIndicator.className = 'status-badge active';
    } else {
        statusIndicator.textContent = '● Inactive';
        statusIndicator.className = 'status-badge inactive';
    }
}

// Handle login form submission
loginFormElement.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    loginError.style.display = 'none';
    showLoading();

    try {
        const response = await chrome.runtime.sendMessage({
            action: 'login',
            data: { email, password }
        });

        if (response.success) {
            // Start monitoring
            await chrome.runtime.sendMessage({ action: 'startMonitoring' });
            await checkStatus();
        } else {
            showLoginForm();
            loginError.textContent = response.error || 'Login failed';
            loginError.style.display = 'block';
        }
    } catch (error) {
        showLoginForm();
        loginError.textContent = 'Network error. Please try again.';
        loginError.style.display = 'block';
    }
});

// Handle logout
logoutBtn.addEventListener('click', async () => {
    showLoading();

    try {
        await chrome.runtime.sendMessage({ action: 'logout' });
        showLoginForm();
    } catch (error) {
        console.error('Error logging out:', error);
        showLoginForm();
    }
});
