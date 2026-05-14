/**
 * Laravel API origin (no trailing slash, no /api suffix).
 *
 * 1) CRA REACT_APP_API_BASE when set at build (local .env or Docker build args).
 * 2) window.__SIA_API_BASE__ — inline in index.html; Docker entrypoint rewrites on Railway.
 * 3) local dev default
 */
export function getApiBase() {
  const fromEnv =
    typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_BASE;
  if (fromEnv && String(fromEnv).trim()) {
    return String(fromEnv).trim().replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.__SIA_API_BASE__ != null) {
    const w = String(window.__SIA_API_BASE__).trim().replace(/\/$/, '');
    if (w) return w;
  }
  return 'http://127.0.0.1:8000';
}
