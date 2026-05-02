const POLL_KEY = 'smart_teacher_monitoring_poll_sec';
const NOTIFY_INCOGNITO_KEY = 'smart_teacher_notify_incognito_desktop';
const ADMIN_TAB_KEY = 'smart_admin_accounts_default_tab';
const ADMIN_CONFIRM_DELETE_KEY = 'smart_admin_confirm_delete';

const VALID_ADMIN_TABS = ['teachers', 'bsit', 'bscs', 'bsemc'];

export function getMonitoringPollSeconds() {
  try {
    const n = parseInt(localStorage.getItem(POLL_KEY) || '15', 10);
    if (Number.isNaN(n)) return 15;
    return Math.min(120, Math.max(5, n));
  } catch (_) {
    return 15;
  }
}

export function setMonitoringPollSeconds(sec) {
  const n = Math.min(120, Math.max(5, parseInt(sec, 10) || 15));
  try {
    localStorage.setItem(POLL_KEY, String(n));
  } catch (_) {}
  return n;
}

/** Desktop notifications when new incognito alerts appear (teacher dashboard). */
export function getNotifyIncognitoDesktop() {
  try {
    return localStorage.getItem(NOTIFY_INCOGNITO_KEY) === 'true';
  } catch (_) {
    return false;
  }
}

export function setNotifyIncognitoDesktop(enabled) {
  try {
    localStorage.setItem(NOTIFY_INCOGNITO_KEY, enabled ? 'true' : 'false');
  } catch (_) {}
}

/** Default tab in Admin → Account Management (Professors / BSIT / BSCS / BSEMC). */
export function getAdminDefaultAccountsTab() {
  try {
    const v = localStorage.getItem(ADMIN_TAB_KEY);
    if (VALID_ADMIN_TABS.includes(v)) return v;
  } catch (_) {}
  return 'teachers';
}

export function setAdminDefaultAccountsTab(tab) {
  const v = VALID_ADMIN_TABS.includes(tab) ? tab : 'teachers';
  try {
    localStorage.setItem(ADMIN_TAB_KEY, v);
  } catch (_) {}
  return v;
}

/** When true (default), account delete asks for confirmation. */
export function getAdminConfirmBeforeDelete() {
  try {
    if (localStorage.getItem(ADMIN_CONFIRM_DELETE_KEY) === 'false') return false;
  } catch (_) {}
  return true;
}

export function setAdminConfirmBeforeDelete(enabled) {
  try {
    localStorage.setItem(ADMIN_CONFIRM_DELETE_KEY, enabled ? 'true' : 'false');
  } catch (_) {}
}
