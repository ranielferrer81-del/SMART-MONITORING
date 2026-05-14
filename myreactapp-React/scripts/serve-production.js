/**
 * Serves build/ like `serve -s`, but GET /api-base.json is always generated from
 * process.env at request time. That matches how Railway injects REACT_APP_API_BASE
 * at runtime (often missing during `react-scripts build`), and avoids SPA fallback
 * eating a static api-base.json file.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { resolveApiBaseRawFromEnv } = require('./resolve-api-base-env');

const ROOT = path.resolve(path.join(__dirname, '..', 'build'));
const PORT = parseInt(process.env.PORT || '3000', 10);

/** Copied from public/railway-fallback.json at build — used when Railway env is empty or broken. */
let __cachedFallbackApiBase;
function readFallbackApiBaseFromBuild() {
  if (__cachedFallbackApiBase !== undefined) return __cachedFallbackApiBase;
  try {
    const p = path.join(ROOT, 'railway-fallback.json');
    if (!fs.existsSync(p)) {
      __cachedFallbackApiBase = '';
      return '';
    }
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    __cachedFallbackApiBase = normalizeApiBase(j.apiBase || '') || '';
    return __cachedFallbackApiBase;
  } catch {
    __cachedFallbackApiBase = '';
    return '';
  }
}

function normalizeApiBase(raw) {
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

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
};

function safeResolvedPath(rootAbs, pathname) {
  const rel = decodeURIComponent((pathname || '/').split('?')[0]).replace(/^\/+/, '');
  if (rel.includes('\0')) return null;
  const abs = path.resolve(path.join(rootAbs, rel || '.'));
  const rootR = path.resolve(rootAbs);
  if (abs !== rootR && !abs.startsWith(rootR + path.sep)) return null;
  return abs;
}

function sendFile(res, filePath, method) {
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const ct = MIME[ext] || 'application/octet-stream';
    if (method === 'HEAD') {
      res.writeHead(200, { 'Content-Type': ct, 'Content-Length': st.size });
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': ct });
    fs.createReadStream(filePath).pipe(res);
  });
}

function sendIndex(res, method) {
  const idx = path.join(ROOT, 'index.html');
  sendFile(res, idx, method);
}

function handler(req, res) {
  const host = req.headers.host || 'localhost';
  const u = new URL(req.url || '/', `http://${host}`);
  const p = u.pathname || '/';

  if (p === '/api-base.json' && (req.method === 'GET' || req.method === 'HEAD')) {
    let apiBase = normalizeApiBase(resolveApiBaseRawFromEnv());
    if (!apiBase) apiBase = readFallbackApiBaseFromBuild();
    const body = JSON.stringify({ apiBase });
    const len = Buffer.byteLength(body);
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Length': len,
    });
    if (req.method === 'HEAD') {
      res.end();
    } else {
      res.end(body);
    }
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405);
    res.end();
    return;
  }

  if (p === '/' || p === '') {
    return sendIndex(res, req.method);
  }

  const filePath = safeResolvedPath(ROOT, p);
  if (!filePath) {
    res.writeHead(403);
    res.end();
    return;
  }

  fs.stat(filePath, (err, st) => {
    if (!err && st.isFile()) {
      return sendFile(res, filePath, req.method);
    }
    if (!err && st.isDirectory()) {
      const idx = path.join(filePath, 'index.html');
      return fs.stat(idx, (e2, st2) => {
        if (!e2 && st2.isFile()) return sendFile(res, idx, req.method);
        return sendIndex(res, req.method);
      });
    }
    return sendIndex(res, req.method);
  });
}

http.createServer(handler).listen(PORT, () => {
  const fromEnv = Boolean(normalizeApiBase(resolveApiBaseRawFromEnv()));
  const fromFile = Boolean(readFallbackApiBaseFromBuild());
  const ok = fromEnv || fromFile;
  console.error(
    `[serve-production] http://0.0.0.0:${PORT}  cwd=${ROOT}  apiBaseFromEnv=${fromEnv ? 'yes' : 'no'}  fromRailwayFallbackJson=${fromFile ? 'yes' : 'no'}  loginReady=${ok ? 'yes' : 'NO'}`,
  );
  if (!ok) {
    console.error(
      '[serve-production] Set REACT_APP_API_BASE on this service, or add public/railway-fallback.json with your Laravel origin and redeploy.',
    );
  }
});
