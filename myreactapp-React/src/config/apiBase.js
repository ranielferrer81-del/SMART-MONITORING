/**
 * Laravel API origin (no trailing slash, no /api suffix).
 *
 * 1) CRA REACT_APP_* API origin vars when set at build (see readReactApiBaseEnv).
 * 2) <meta name="sia-api-origin" content="..."> — patched at deploy (scripts/patch-api-base.js).
 * 3) window.__SIA_API_BASE__ — same patch / local default in public/index.html.
 * 4) On *.railway.app, localhost origins from (1) or (3) are ignored so stale builds still use (2).
 * 5) Local dev default http://127.0.0.1:8000
 */
function readReactApiBaseEnv() {
  if (typeof process === 'undefined' || !process.env) return '';
  const keys = [
    'REACT_APP_API_BASE',
    'REACT_APP_APT_BASE',
    'REACT_APP_BACKEND_URL',
    'REACT_APP_LARAVEL_URL',
  ];
  for (const k of keys) {
    const v = process.env[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return '';
}

function readMetaApiOrigin() {
  if (typeof document === 'undefined') return '';
  const el = document.querySelector('meta[name="sia-api-origin"]');
  const c = el?.getAttribute('content');
  if (c == null) return '';
  return String(c).trim();
}

function isLocalDevApiUrl(url) {
  return (
    url === '' ||
    url === 'http://127.0.0.1:8000' ||
    url === 'http://localhost:8000'
  );
}

function isRailwayHosted() {
  if (typeof window === 'undefined') return false;
  return /\.railway\.app$/i.test(window.location.hostname);
}

function normalizeOrigin(raw) {
  let s = String(raw || '')
    .trim()
    .replace(/\r/g, '')
    .replace(/\/$/, '')
    .replace(/\/api\/?$/i, '');
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  // Railway / copy-paste without scheme (e.g. "something.up.railway.app")
  if (/^[a-z0-9.-]+\.[a-z]{2,}(:[0-9]+)?$/i.test(s)) {
    return `https://${s}`;
  }
  return s;
}

export function getApiBase() {
  const railway = isRailwayHosted();
  const fromNorm = normalizeOrigin(readReactApiBaseEnv());
  const metaNorm = normalizeOrigin(readMetaApiOrigin());
  const windowNorm =
    typeof window !== 'undefined' && window.__SIA_API_BASE__ != null
      ? normalizeOrigin(String(window.__SIA_API_BASE__))
      : '';

  const candidates = [fromNorm, metaNorm, windowNorm].filter(Boolean);
  for (const c of candidates) {
    if (railway && isLocalDevApiUrl(c)) continue;
    return c;
  }
  return 'http://127.0.0.1:8000';
}
