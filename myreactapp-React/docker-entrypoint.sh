#!/bin/sh
set -e
# Railway often injects REACT_APP_API_BASE at runtime only; CRA bakes API URL at build time.
# If the bundle still contains the dev default, replace it before serve starts.
if [ -n "$REACT_APP_API_BASE" ]; then
  export REACT_APP_API_BASE
  node <<'NODE'
const fs = require('fs');
const path = require('path');
const base = (process.env.REACT_APP_API_BASE || '').replace(/\/$/, '');
if (!base) process.exit(0);
const from = 'http://127.0.0.1:8000';
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.isFile() && e.name.endsWith('.js') && !e.name.endsWith('.map')) {
      const s = fs.readFileSync(p, 'utf8');
      if (s.includes(from)) fs.writeFileSync(p, s.split(from).join(base));
    }
  }
}
const root = path.join(process.cwd(), 'build');
if (fs.existsSync(root)) walk(root);
NODE
fi
exec "$@"
