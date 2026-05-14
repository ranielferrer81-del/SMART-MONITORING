#!/bin/sh
set -e
# Railway: REACT_APP_API_BASE is correct in the dashboard but CRA may still bake
# http://127.0.0.1:8000 into the bundle (Docker build often does not see the var).
# Patch all built JS before serve. Logs go to stderr so Railway deploy logs show it ran.
BASE_RAW="${REACT_APP_API_BASE:-}"
BASE_RAW=$(printf '%s' "$BASE_RAW" | tr -d '\r')
export REACT_APP_API_BASE="$BASE_RAW"

if [ -z "$REACT_APP_API_BASE" ]; then
  echo "[docker-entrypoint] WARNING: REACT_APP_API_BASE is empty — bundle will keep localhost API URL." >&2
else
  echo "[docker-entrypoint] Patching build/ JS with API base (length ${#REACT_APP_API_BASE} chars)." >&2
  export REACT_APP_API_BASE
  node <<'NODE'
const fs = require('fs');
const path = require('path');
const base = (process.env.REACT_APP_API_BASE || '').replace(/\/$/, '');
if (!base) process.exit(0);
const needles = ['http://127.0.0.1:8000', 'http://localhost:8000'];
let total = 0;
let files = 0;
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.isFile() && e.name.endsWith('.js') && !e.name.endsWith('.map')) {
      let s = fs.readFileSync(p, 'utf8');
      let changed = false;
      for (const from of needles) {
        const parts = s.split(from);
        if (parts.length > 1) {
          total += parts.length - 1;
          s = parts.join(base);
          changed = true;
        }
      }
      if (changed) {
        fs.writeFileSync(p, s);
        files++;
      }
    }
  }
}
const root = path.join(process.cwd(), 'build');
if (!fs.existsSync(root)) {
  console.error('[docker-entrypoint] ERROR: /app/build missing — was npm run build skipped?');
  process.exit(1);
}
walk(root);
console.error('[docker-entrypoint] Patched', files, 'file(s),', total, 'replacement(s).');
if (total === 0) {
  console.error('[docker-entrypoint] WARNING: no localhost URLs found in bundle — wrong build or already patched.');
}
NODE
fi
exec "$@"
