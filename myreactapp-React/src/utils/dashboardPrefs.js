const POLL_KEY = 'smart_teacher_monitoring_poll_sec';
const THEME_MODE_KEY = 'smart_dashboard_theme_mode';

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

export function getThemeMode() {
  try {
    const m = localStorage.getItem(THEME_MODE_KEY);
    if (m === 'light' || m === 'dark' || m === 'system') return m;
  } catch (_) {}
  try {
    const t = localStorage.getItem('theme');
    if (t === 'dark') return 'dark';
    if (t === 'light') return 'light';
  } catch (_) {}
  return 'system';
}

export function setThemeMode(mode) {
  const m = mode === 'light' || mode === 'dark' || mode === 'system' ? mode : 'system';
  try {
    localStorage.setItem(THEME_MODE_KEY, m);
  } catch (_) {}
  applyThemeMode(m);
  return m;
}

/** Apply theme to document root (works with existing ThemeToggle localStorage `theme` for light/dark). */
export function applyThemeMode(mode) {
  if (typeof document === 'undefined') return;
  if (mode === 'system') {
    try {
      localStorage.removeItem('theme');
    } catch (_) {}
    const prefers =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', !!prefers);
  } else if (mode === 'dark') {
    try {
      localStorage.setItem('theme', 'dark');
    } catch (_) {}
    document.documentElement.classList.add('dark');
  } else {
    try {
      localStorage.setItem('theme', 'light');
    } catch (_) {}
    document.documentElement.classList.remove('dark');
  }
}
