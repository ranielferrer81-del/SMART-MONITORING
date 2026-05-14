/**
 * Laravel API origin (no trailing slash, no /api suffix).
 *
 * Resolution order on a public deploy (not localhost):
 *   meta → window → CRA env → synchronous GET /api-base.json (written at container start).
 * Local dev: CRA env → meta → window → default http://127.0.0.1:8000
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

/** True when the page is clearly not local dev (Railway, Vercel, custom domain, etc.). */
function isPublicDeployment() {
  if (typeof window === 'undefined') return false;
  const h = (window.location.hostname || '').toLowerCase();
  return h !== 'localhost' && h !== '127.0.0.1';
}

function normalizeOrigin(raw) {
  let s = String(raw || '')
    .trim()
    .replace(/\r/g, '')
    .replace(/^["']|["']$/g, '')
    .trim()
    .replace(/\/$/, '')
    .replace(/\/api\/?$/i, '');
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  if (/^[a-z0-9.-]+\.[a-z]{2,}(:[0-9]+)?$/i.test(s)) {
    return `https://${s}`;
  }
  return s;
}

/** Same-origin /api-base.json from the static host (populated by scripts/patch-api-base.js). */
let __siaApiBaseJsonMemo;
function readApiBaseFromDeployedJson() {
  if (__siaApiBaseJsonMemo !== undefined) return __siaApiBaseJsonMemo;
  let out = '';
  if (typeof window === 'undefined' || typeof XMLHttpRequest === 'undefined') {
    __siaApiBaseJsonMemo = out;
    return out;
  }
  try {
    const pub =
      (typeof process !== 'undefined' && process.env && process.env.PUBLIC_URL) || '';
    const normalizedPub = pub.endsWith('/') ? pub.slice(0, -1) : pub;
    const root =
      window.location.origin +
      (normalizedPub === '' || normalizedPub.startsWith('/')
        ? normalizedPub
        : `/${normalizedPub}`);
    const baseForUrl = root.endsWith('/') ? root : `${root}/`;
    const url = new URL('api-base.json', baseForUrl).href;
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.send(null);
    if (xhr.status === 200) {
      const text = String(xhr.responseText || '').trim();
      if (text.startsWith('{')) {
        const j = JSON.parse(text);
        const b = j && j.apiBase != null ? String(j.apiBase).trim() : '';
        if (b) out = b;
      }
    }
  } catch {
    out = '';
  }
  __siaApiBaseJsonMemo = out;
  return out;
}

export function getApiBase() {
  const deployed = isPublicDeployment();
  const fromNorm = normalizeOrigin(readReactApiBaseEnv());
  const metaNorm = normalizeOrigin(readMetaApiOrigin());
  const windowNorm =
    typeof window !== 'undefined' && window.__SIA_API_BASE__ != null
      ? normalizeOrigin(String(window.__SIA_API_BASE__))
      : '';

  const primary = (
    deployed ? [metaNorm, windowNorm, fromNorm] : [fromNorm, metaNorm, windowNorm]
  ).filter(Boolean);

  for (const c of primary) {
    if (deployed && isLocalDevApiUrl(c)) continue;
    if (c) return c;
  }

  if (deployed) {
    const j = normalizeOrigin(readApiBaseFromDeployedJson());
    if (j && !isLocalDevApiUrl(j)) return j;

    if (typeof window !== 'undefined' && !window.__SIA_API_BASE_CONFIG_WARNED__) {
      window.__SIA_API_BASE_CONFIG_WARNED__ = true;
      console.error(
        '[SIA] No backend API URL found for this deployment. On the frontend service (e.g. SMART-MONITORING), set:\n' +
          '  REACT_APP_API_BASE=https://YOUR-LARAVEL.up.railway.app\n' +
          'Then redeploy. Check deploy logs for [patch-api-base] and open /api-base.json in the browser — it must show {"apiBase":"https://..."}.',
      );
    }
    return '';
  }
  return 'http://127.0.0.1:8000';
}
