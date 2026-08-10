/**
 * Laravel API origin (no trailing slash, no /api suffix).
 * Local default: http://127.0.0.1:8000
 * Packaged builds: public/api-base.json + dist-electron/build-config.json (CI sets VITE_API_BASE_URL).
 */
const LOCAL_API_DEFAULT = 'http://127.0.0.1:8000';

export const normalizeBaseUrl = (url: string) => {
  if (!url) return LOCAL_API_DEFAULT;
  // .env mistakes like "https://api.example.com || http://127.0.0.1:8000" are not comments in dotenv.
  let u = url.trim().split(/\s+\|\|/)[0]?.trim() ?? '';
  if (!u) return LOCAL_API_DEFAULT;
  u = u.endsWith('/') ? u.slice(0, -1) : u;
  if (u.toLowerCase().endsWith('/api')) {
    u = u.slice(0, -4);
    if (u.endsWith('/')) u = u.slice(0, -1);
  }
  return u;
};

export const getViteApiBaseUrl = () =>
  normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL ?? LOCAL_API_DEFAULT);

let resolvedApiBaseUrl: string | null = null;

export function getApiBaseUrl(): string {
  return resolvedApiBaseUrl ?? getViteApiBaseUrl();
}

export async function initApiBaseUrl(): Promise<string> {
  if (resolvedApiBaseUrl) return resolvedApiBaseUrl;

  let url = getViteApiBaseUrl();

  // Dev: trust VITE_API_BASE_URL / .env. Production: api-base.json from the built bundle wins.
  if (!import.meta.env.DEV) {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api-base.json`, { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as { apiBase?: string };
        if (typeof data.apiBase === 'string' && data.apiBase.trim()) {
          url = normalizeBaseUrl(data.apiBase);
        }
      }
    } catch {
      // keep Vite env / default
    }
  }

  resolvedApiBaseUrl = url;
  return url;
}
