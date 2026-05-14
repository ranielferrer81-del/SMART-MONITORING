#!/bin/sh
set -e
# Prefer REACT_APP_API_BASE; accept REACT_APP_APT_BASE (common Railway typo).
BASE_RAW="${REACT_APP_API_BASE:-${REACT_APP_APT_BASE:-}}"
BASE_RAW=$(printf '%s' "$BASE_RAW" | tr -d '\r')
if [ -n "$BASE_RAW" ]; then
  export REACT_APP_API_BASE="$BASE_RAW"
fi
_ROOT="$(cd "$(dirname "$0")" && pwd)"
node "$_ROOT/scripts/patch-api-base.js"
exec "$@"
