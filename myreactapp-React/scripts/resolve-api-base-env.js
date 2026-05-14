/**
 * Shared by patch-api-base.js (Node). Picks the first non-empty API origin from env.
 * Strips trailing /api so the value matches what the React client expects (origin only).
 */
function stripTrailingApiPath(s) {
  return String(s || '')
    .trim()
    .replace(/\r/g, '')
    .replace(/\/api\/?$/i, '')
    .replace(/\/$/, '');
}

function hasUnexpandedRailwayReference(s) {
  return /\$\{\{/.test(String(s || ''));
}

/** @param {Record<string, string | undefined>} [env] */
function resolveApiBaseRawFromEnv(env = process.env) {
  const keys = [
    'REACT_APP_API_BASE',
    'REACT_APP_APT_BASE',
    'SIA_API_BASE',
    'BACKEND_URL',
    'LARAVEL_URL',
    'API_URL',
    'APP_URL',
    'PUBLIC_API_URL',
  ];
  for (const k of keys) {
    const v = env[k];
    if (v == null || !String(v).trim()) continue;
    if (hasUnexpandedRailwayReference(v)) {
      console.error(
        `[resolve-api-base] ${k} contains \${{ ... }} but Railway did not substitute it — use your backend service's exact name in the reference, or set a plain https URL. Skipping.`,
      );
      continue;
    }
    return stripTrailingApiPath(v);
  }
  return '';
}

module.exports = { resolveApiBaseRawFromEnv, stripTrailingApiPath };
