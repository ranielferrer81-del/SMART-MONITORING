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
    console.error(
      '[patch-api-base] WARNING: REACT_APP_API_BASE and REACT_APP_APT_BASE unset — API calls use default localhost in index.html.',
    );
    process.exit(0);
  }

  let html = fs.readFileSync(indexPath, 'utf8');
  const repl = `window.__SIA_API_BASE__=${JSON.stringify(base)};`;
  const re = /window\.__SIA_API_BASE__\s*=\s*("[^"]*"|'[^']*')\s*;?/;
  if (!re.test(html)) {
    console.error('[patch-api-base] ERROR: __SIA_API_BASE__ marker not found in index.html');
    process.exit(1);
  }
  html = html.replace(re, repl);
  fs.writeFileSync(indexPath, html);
  console.error(`[patch-api-base] Patched build/index.html with API base (len ${base.length}).`);
}

main();
