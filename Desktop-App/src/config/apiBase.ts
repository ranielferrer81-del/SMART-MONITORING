/**
 * API origin — dev and packaged app both use Railway Laravel (public/api-base.json).
 * VITE_API_BASE_URL in .env can override when api-base.json is missing.
 */
const RAILWAY_API_DEFAULT = 'https://elegant-sparkle-production-97fc.up.railway.app';

export const normalizeBaseUrl = (url: string) => {
  if (!url) return RAILWAY_API_DEFAULT;
  // .env mistakes like "https://api.railway.app || http://127.0.0.1:8000" are not comments in dotenv.
  let u = url.trim().split(/\s+\|\|/)[0]?.trim() ?? '';
  if (!u) return RAILWAY_API_DEFAULT;
  u = u.endsWith('/') ? u.slice(0, -1) : u;
  if (u.toLowerCase().endsWith('/api')) {
    u = u.slice(0, -4);
    if (u.endsWith('/')) u = u.slice(0, -1);
  }
  return u;
};

export const getViteApiBaseUrl = () =>
  normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL ?? RAILWAY_API_DEFAULT);

let resolvedApiBaseUrl: string | null = null;

export function getApiBaseUrl(): string {
  return resolvedApiBaseUrl ?? getViteApiBaseUrl();
}

export async function initApiBaseUrl(): Promise<string> {
  if (resolvedApiBaseUrl) return resolvedApiBaseUrl;

  let url = getViteApiBaseUrl();

  try {
    const res = await fetch(`${import.meta.env.BASE_URL}api-base.json`, { cache: 'no-store' });
    if (res.ok) {
      const data = (await res.json()) as { apiBase?: string };
      if (typeof data.apiBase === 'string' && data.apiBase.trim()) {
        url = normalizeBaseUrl(data.apiBase);
      }
    }
  } catch {
    // keep .env / default Railway URL
  }

  resolvedApiBaseUrl = url;
  return url;
}
