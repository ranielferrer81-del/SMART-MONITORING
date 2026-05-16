/**
 * API origin for the desktop app. Packaged builds must match the React app's Laravel service.
 *
 * Priority:
 * 1. public/api-base.json (shipped in dist/, same URL as myreactapp-React/railway-fallback.json)
 * 2. VITE_API_BASE_URL from .env / GitHub Actions build
 * 3. http://127.0.0.1:8000
 */
export const normalizeBaseUrl = (url: string) => {
  if (!url) return 'http://127.0.0.1:8000';
  let u = url.trim();
  u = u.endsWith('/') ? u.slice(0, -1) : u;
  if (u.toLowerCase().endsWith('/api')) {
    u = u.slice(0, -4);
    if (u.endsWith('/')) u = u.slice(0, -1);
  }
  return u;
};

export const getViteApiBaseUrl = () =>
  normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000');

let resolvedApiBaseUrl: string | null = null;

export function getApiBaseUrl(): string {
  return resolvedApiBaseUrl ?? getViteApiBaseUrl();
}

/** Load api-base.json before first API call so .exe uses the same Railway URL as dev. */
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
    // Offline or missing file — keep Vite-baked URL
  }

  resolvedApiBaseUrl = url;
  return url;
}
