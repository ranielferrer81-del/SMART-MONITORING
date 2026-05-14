#!/bin/sh
set -e
# Rewrite API base into build/index.html (inline, no extra request — works with serve -s).
# Prefer REACT_APP_API_BASE; accept REACT_APP_APT_BASE (common Railway typo).
BASE_RAW="${REACT_APP_API_BASE:-${REACT_APP_APT_BASE:-}}"
BASE_RAW=$(printf '%s' "$BASE_RAW" | tr -d '\r')

if [ -n "$BASE_RAW" ]; then
  export REACT_APP_API_BASE="$BASE_RAW"
  node <<'NODE'
const fs = require('fs');
const path = require('path');
let base = (process.env.REACT_APP_API_BASE || '').trim().replace(/\/$/, '');
if (!base) process.exit(0);
if (!/^https?:\/\//i.test(base) && /^[a-z0-9.-]+\.[a-z]{2,}(:[0-9]+)?$/i.test(base)) {
  base = 'https://' + base;
}
const indexPath = path.join(process.cwd(), 'build', 'index.html');
if (!fs.existsSync(indexPath)) {
  console.error('[docker-entrypoint] ERROR: build/index.html missing');
  process.exit(1);
}
let html = fs.readFileSync(indexPath, 'utf8');
const repl = 'window.__SIA_API_BASE__=' + JSON.stringify(base) + ';';
const re = /window\.__SIA_API_BASE__\s*=\s*("[^"]*"|'[^']*')\s*;?/;
if (!re.test(html)) {
  console.error('[docker-entrypoint] ERROR: __SIA_API_BASE__ marker not found in index.html');
  process.exit(1);
}
html = html.replace(re, repl);
fs.writeFileSync(indexPath, html);
console.error('[docker-entrypoint] Patched index.html with API base (len ' + base.length + ').');
NODE
else
  echo "[docker-entrypoint] WARNING: REACT_APP_API_BASE and REACT_APP_APT_BASE unset — API calls use default localhost in index.html." >&2
fi

exec "$@"
