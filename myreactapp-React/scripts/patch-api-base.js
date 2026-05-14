/**
 * Patch build/index.html with API origin before `serve` (Railway Nixpacks / npm start).
 * Docker entrypoint calls this too — same behavior with or without Docker.
 */
const fs = require('fs');
const path = require('path');
const { resolveApiBaseRawFromEnv } = require('./resolve-api-base-env');

function normalizeBase(raw) {
  let base = String(raw || '')
    .trim()
    .replace(/\r/g, '')
    .replace(/\/$/, '');
  if (!base) return '';
  if (!/^https?:\/\//i.test(base) && /^[a-z0-9.-]+\.[a-z]{2,}(:[0-9]+)?$/i.test(base)) {
    return `https://${base}`;
  }
  return base;
}

function patchWindowScript(html, base) {
  if (!base || !String(base).trim()) return html;
  const repl = `window.__SIA_API_BASE__=${JSON.stringify(base)};`;
  const re = /window\.__SIA_API_BASE__\s*=\s*("[^"]*"|'[^']*')\s*;?/;
  if (!re.test(html)) return html;
  return html.replace(re, repl);
}

function escapeHtmlAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function patchMetaOrigin(html, base) {
  const re =
    /<meta\s+name=["']sia-api-origin["']\s+content=(["'])([^"']*)\1\s*\/?>/i;
  if (!re.test(html)) {
    console.error('[patch-api-base] WARNING: sia-api-origin meta not found (add to public/index.html)');
    return html;
  }
  return html.replace(re, `<meta name="sia-api-origin" content="${escapeHtmlAttr(base)}" />`);
}

function main() {
  const raw = resolveApiBaseRawFromEnv();
  const base = normalizeBase(raw);

  const root = path.join(__dirname, '..');
  const indexPath = path.join(root, 'build', 'index.html');
  const jsonPath = path.join(root, 'build', 'api-base.json');

  if (!fs.existsSync(indexPath)) {
    console.error('[patch-api-base] ERROR: build/index.html missing — run npm run build first.');
    process.exit(1);
  }

  let html = fs.readFileSync(indexPath, 'utf8');
  html = patchMetaOrigin(html, base || '');
  html = patchWindowScript(html, base);
  fs.writeFileSync(indexPath, html);
  fs.writeFileSync(jsonPath, JSON.stringify({ apiBase: base || '' }) + '\n');

  if (!base) {
    const onRailway = Boolean(
      process.env.RAILWAY_ENVIRONMENT ||
        process.env.RAILWAY_PROJECT_ID ||
        process.env.RAILWAY_SERVICE_ID,
    );
    if (onRailway) {
      console.error(
        '[patch-api-base] WARNING on Railway: no API origin in env. Set REACT_APP_API_BASE on this service (Laravel origin, no trailing /api). Aliases: REACT_APP_APT_BASE, SIA_API_BASE, BACKEND_URL, LARAVEL_URL, API_URL, APP_URL, PUBLIC_API_URL. Example reference:\n' +
          '  REACT_APP_API_BASE=https://${{ elegant-sparkle.RAILWAY_PUBLIC_DOMAIN }}\n' +
          '(Replace elegant-sparkle with your backend service name.)',
      );
    } else {
      console.error(
        '[patch-api-base] WARNING: API origin env unset — api-base.json empty; local dev uses localhost.',
      );
    }
    process.exit(0);
  }

  console.error(`[patch-api-base] Patched build (meta + api-base.json), API base len ${base.length}.`);
}

main();
