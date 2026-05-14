/**
 * Patch build/index.html with API origin before `serve` (Railway Nixpacks / npm start).
 * Docker entrypoint calls this too — same behavior with or without Docker.
 */
const fs = require('fs');
const path = require('path');

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
  const repl = `window.__SIA_API_BASE__=${JSON.stringify(base)};`;
  const re = /window\.__SIA_API_BASE__\s*=\s*("[^"]*"|'[^']*')\s*;?/;
  if (!re.test(html)) {
    console.error('[patch-api-base] ERROR: __SIA_API_BASE__ marker not found in index.html');
    return null;
  }
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
  const raw = (process.env.REACT_APP_API_BASE || process.env.REACT_APP_APT_BASE || '')
    .trim()
    .replace(/\r/g, '');
  const base = normalizeBase(raw);

  const root = path.join(__dirname, '..');
  const indexPath = path.join(root, 'build', 'index.html');

  if (!fs.existsSync(indexPath)) {
    console.error('[patch-api-base] ERROR: build/index.html missing — run npm run build first.');
    process.exit(1);
  }

  if (!base) {
    const onRailway = Boolean(
      process.env.RAILWAY_ENVIRONMENT ||
        process.env.RAILWAY_PROJECT_ID ||
        process.env.RAILWAY_SERVICE_ID,
    );
    if (onRailway) {
      console.error(
        '[patch-api-base] FATAL on Railway: REACT_APP_API_BASE (or REACT_APP_APT_BASE) is not set on this service. Set it to your Laravel API origin (no trailing /api).',
      );
      process.exit(1);
    }
    console.error(
      '[patch-api-base] WARNING: REACT_APP_API_BASE and REACT_APP_APT_BASE unset — API calls use default localhost in index.html.',
    );
    process.exit(0);
  }

  let html = fs.readFileSync(indexPath, 'utf8');
  html = patchMetaOrigin(html, base);
  const afterWindow = patchWindowScript(html, base);
  if (afterWindow == null) process.exit(1);
  html = afterWindow;
  fs.writeFileSync(indexPath, html);
  console.error(`[patch-api-base] Patched build/index.html (meta + window), API base len ${base.length}.`);
}

main();
