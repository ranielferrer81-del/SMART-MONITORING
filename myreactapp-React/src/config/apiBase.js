/**
 * Laravel API origin (no trailing slash, no /api suffix).
 *
 * 1) CRA REACT_APP_API_BASE when set at build (local .env or Docker build args).
 * 2) REACT_APP_APT_BASE — legacy typo seen on some hosts; treated as alias of (1).
 * 3) window.__SIA_API_BASE__ — inline in index.html; Docker entrypoint rewrites on Railway.
 * 4) local dev default
 */
function readReactApiBaseEnv() {
  if (typeof process === 'undefined' || !process.env) return '';
  const primary = process.env.REACT_APP_API_BASE;
  if (primary != null && String(primary).trim()) return String(primary).trim();
  const typoAlias = process.env.REACT_APP_APT_BASE;
  if (typoAlias != null && String(typoAlias).trim()) return String(typoAlias).trim();
  return '';
}

function normalizeOrigin(raw) {
  let s = String(raw || '').trim().replace(/\/$/, '');
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  // Railway / copy-paste without scheme (e.g. "something.up.railway.app")
  if (/^[a-z0-9.-]+\.[a-z]{2,}(:[0-9]+)?$/i.test(s)) {
    return `https://${s}`;
  }
  return s;
}

export function getApiBase() {
  const fromEnv = readReactApiBaseEnv();
  if (fromEnv) {
    return normalizeOrigin(fromEnv);
  }
  if (typeof window !== 'undefined' && window.__SIA_API_BASE__ != null) {
    const w = normalizeOrigin(window.__SIA_API_BASE__);
    if (w) return w;
  }
  return 'http://127.0.0.1:8000';
}
