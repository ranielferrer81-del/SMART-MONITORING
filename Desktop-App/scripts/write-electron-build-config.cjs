/**
 * Writes dist-electron/build-config.json from VITE_API_BASE_URL (process.env or .env).
 * Run after tsc so the packaged app main process uses the same API origin as the Vite build.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'dist-electron');
const outFile = path.join(outDir, 'build-config.json');

function normalizeApiBaseUrl(url) {
  if (!url || typeof url !== 'string') return null;
  let u = url.trim().replace(/^["']|["']$/g, '');
  if (!u) return null;
  if (u.endsWith('/')) u = u.slice(0, -1);
  if (u.toLowerCase().endsWith('/api')) {
    u = u.slice(0, -4);
    if (u.endsWith('/')) u = u.slice(0, -1);
  }
  return u;
}

function readFromDotEnv() {
  const envPath = path.join(root, '.env');
  if (!fs.existsSync(envPath)) return null;
  const match = fs.readFileSync(envPath, 'utf-8').match(/^VITE_API_BASE_URL\s*=\s*(.+)/m);
  if (!match) return null;
  return match[1].trim().replace(/["']/g, '');
}

function main() {
  if (!fs.existsSync(outDir)) {
    console.error('write-electron-build-config: dist-electron missing; run tsc first.');
    process.exit(1);
  }

  const raw = process.env.VITE_API_BASE_URL?.trim() || readFromDotEnv();
  const viteApiBaseUrl = normalizeApiBaseUrl(raw);

  if (viteApiBaseUrl) {
    fs.writeFileSync(outFile, `${JSON.stringify({ viteApiBaseUrl })}\n`, 'utf-8');
    console.log(`write-electron-build-config: wrote ${path.relative(root, outFile)} (${viteApiBaseUrl})`);
  } else {
    try {
      if (fs.existsSync(outFile)) fs.unlinkSync(outFile);
    } catch {
      /* ignore */
    }
    console.log(
      'write-electron-build-config: no VITE_API_BASE_URL; main process will use .env or default'
    );
  }
}

main();
