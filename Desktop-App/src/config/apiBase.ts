/** Vite embeds VITE_API_BASE_URL at build time — set in Desktop-App/.env for Railway or local Laravel. */
export const normalizeBaseUrl = (url: string) => {
  if (!url) return 'http://127.0.0.1:8000';
  return url.endsWith('/') ? url.slice(0, -1) : url;
};

export const getViteApiBaseUrl = () =>
  normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000');
