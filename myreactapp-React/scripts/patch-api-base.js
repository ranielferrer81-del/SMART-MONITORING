/**
 * Patch build/index.html with API origin before `serve` (Railway Nixpacks / npm start).
 * Docker entrypoint calls this too — same behavior with or without Docker.
 */
const fs = require('fs');
const path = require('path');
const { resolveApiBaseRawFromEnv } = require('./resolve-api-base-env');

function normalizeBase(raw) {
  let s = String(raw || '')
    .trim()
    .replace(/\r/g, '')
    .replace(/^["']|["']$/g, '')
    .trim()
    .replace(/\/$/, '');
  if (!s) return '';
  if (!/^https?:\/\//i.test(s) && /^[a-z0-9.-]+\.[a-z]{2,}(:[0-9]+)?$/i.test(s)) {
    return `https://${s}`;
  }
  return s;
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
  const patterns = [
    /<meta\s+name=["']sia-api-origin["']\s+content=(["'])([^"']*)\1\s*\/?>/i,
    /<meta[^>]*\bname=["']sia-api-origin["'][^>]*\bcontent=(["'])([^"']*)\1[^>]*\/?>/i,
    /<meta[^>]*\bcontent=(["'])([^"']*)\1[^>]*\bname=["']sia-api-origin["'][^>]*\/?>/i,
  ];
  let re = null;
  for (const p of patterns) {
    if (p.test(html)) {
      re = p;
      break;
    }
  }
  if (!re) {
    console.error('[patch-api-base] WARNING: sia-api-origin meta not found (add to public/index.html)');
    return html;
  }
  return html.replace(
    re,
    `<meta name="sia-api-origin" content="${escapeHtmlAttr(base)}" />`,
  );
}

/** Last script in <head> wins over the bootstrap IIFE (fixes minified meta / json fetch issues). */
function injectHeadApiScript(html, base) {
  if (!base || !String(base).trim()) return html;
  html = html.replace(/<script id="sia-railway-api-base"[^<]*<\/script>\s*/gi, '');
  const tag =
    '<script id="sia-railway-api-base">window.__SIA_API_BASE__=' +
    JSON.stringify(base) +
    ';</script>';
  const m = html.match(/<\/head>/i);
  if (!m || m.index == null) {
    console.error('[patch-api-base] WARNING: no </head> found, cannot inject API base script');
    return html;
  }
  const i = m.index;
  return html.slice(0, i) + tag + html.slice(i);
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
  html = injectHeadApiScript(html, base);
  fs.writeFileSync(indexPath, html);
  fs.writeFileSync(jsonPath, JSON.stringify({ apiBase: base || '' }) + '\n');

  if (!base) {
    let fallbackBase = '';
    try {
      const fp = path.join(root, 'build', 'railway-fallback.json');
      if (fs.existsSync(fp)) {
        const j = JSON.parse(fs.readFileSync(fp, 'utf8'));
        fallbackBase = normalizeBase(j.apiBase || '');
      }
    } catch {
      /* ignore */
    }

    const onRailway = Boolean(
      process.env.RAILWAY_ENVIRONMENT ||
        process.env.RAILWAY_PROJECT_ID ||
        process.env.RAILWAY_SERVICE_ID,
    );
    if (onRailway) {
      if (fallbackBase) {
        console.error(
          `[patch-api-base] No REACT_APP_* in env; using build/railway-fallback.json for API origin (${fallbackBase.length} chars). Optional: set REACT_APP_API_BASE to override.`,
        );
      } else {
        console.error(
          '[patch-api-base] WARNING on Railway: no API origin in env and no railway-fallback.json. Set REACT_APP_API_BASE on this service (Laravel origin, no trailing /api).',
        );
      }
    } else {
      console.error(
        '[patch-api-base] WARNING: API origin env unset — api-base.json empty; local dev uses localhost.',
      );
    }
    process.exit(0);
  }

  console.error(
    `[patch-api-base] Patched build (meta + head script + api-base.json), host len ${String(base).length}.`,
  );
}

main();
