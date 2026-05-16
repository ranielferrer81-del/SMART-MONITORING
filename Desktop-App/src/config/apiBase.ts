/**
 * API origin for the desktop app.
 *
 * Development: VITE_API_BASE_URL in .env only (never overridden by api-base.json).
 * Production (.exe): public/api-base.json then Vite-baked env.
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

export async function initApiBaseUrl(): Promise<string> {
  if (resolvedApiBaseUrl) return resolvedApiBaseUrl;

  let url = getViteApiBaseUrl();

  // Packaged app only — do not override .env during npm run dev (localhost Laravel).
  if (import.meta.env.PROD) {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api-base.json`, { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as { apiBase?: string };
        if (typeof data.apiBase === 'string' && data.apiBase.trim()) {
          url = normalizeBaseUrl(data.apiBase);
        }
      }
    } catch {
      // keep Vite-baked URL
    }
  }

  resolvedApiBaseUrl = url;
  return url;
}
