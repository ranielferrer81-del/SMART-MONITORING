/**
 * Format API datetime strings for teacher/admin dashboards (local timezone).
 */
export function formatMonitoringDateTime(value) {
  if (value == null || value === '') return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  try {
    return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'medium' });
  } catch {
    return String(value);
  }
}

/** When student finished PIN on Desktop-App (preferred record of “logged on this PC”). */
export function getPcLoginAt(onlineInfo) {
  if (!onlineInfo || typeof onlineInfo !== 'object') return null;
  const pin = onlineInfo.desktop_telemetry?.monitoring_ready_at;
  if (pin) return pin;
  return onlineInfo.monitoring_session_start ?? null;
}

/** Server session_end; null while still signed in / session active. */
export function formatPcLogoutAt(onlineInfo) {
  if (!onlineInfo || typeof onlineInfo !== 'object') return '—';
  const end = onlineInfo.monitoring_session_end;
  if (end != null && end !== '') return formatMonitoringDateTime(end);
  return 'Still signed in';
}
