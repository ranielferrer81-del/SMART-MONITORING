/**
 * Vite embeds VITE_API_BASE_URL at build time — set in Desktop-App/.env for Railway or local Laravel.
 *
 * Axios calls use paths like `/api/validate-email`. If the base URL already ends with `/api`, you would
 * hit `/api/api/...` and get 404 — so we strip a trailing `/api` here. Same idea as monitoring-server.cjs.
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
