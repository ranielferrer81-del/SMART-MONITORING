#!/bin/sh
set -e
# Runtime API URL for production: CRA often bakes localhost before this runs; we overwrite
# build/api-config.js so window.__SIA_API_BASE__ is correct before the React bundle executes.
BASE_RAW="${REACT_APP_API_BASE:-}"
BASE_RAW=$(printf '%s' "$BASE_RAW" | tr -d '\r')

if [ -n "$BASE_RAW" ]; then
  export REACT_APP_API_BASE="$BASE_RAW"
  node <<'NODE'
const fs = require('fs');
const path = require('path');
const base = (process.env.REACT_APP_API_BASE || '').replace(/\/$/, '');
const outPath = path.join(process.cwd(), 'build', 'api-config.js');
if (!base) process.exit(0);
if (!fs.existsSync(outPath)) {
  console.error('[docker-entrypoint] ERROR: build/api-config.js missing — build failed?');
  process.exit(1);
}
const body = 'window.__SIA_API_BASE__=' + JSON.stringify(base) + ';\n';
fs.writeFileSync(outPath, body);
console.error('[docker-entrypoint] Wrote api-config.js for API base (length ' + base.length + ').');
NODE
else
  echo "[docker-entrypoint] WARNING: REACT_APP_API_BASE unset — using baked-in api-config.js (localhost)." >&2
fi

exec "$@"
