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
