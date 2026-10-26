/**
 * Laravel API origin (no trailing slash, no /api suffix).
 * Online Cloud default: https://smart-monitoring-production.up.railway.app
 * Localhost default: http://127.0.0.1:8000
 */
export const CLOUD_API_DEFAULT = 'https://smart-monitoring-production.up.railway.app';
export const LOCAL_API_DEFAULT = 'http://127.0.0.1:8000';

export type ServerMode = 'cloud' | 'local' | 'custom';

export const STORAGE_SERVER_MODE_KEY = 'smart_server_mode';
export const STORAGE_CUSTOM_URL_KEY = 'smart_custom_api_url';
export const STORAGE_ACTIVE_URL_KEY = 'smart_active_api_url';

export const normalizeBaseUrl = (url: string | null | undefined): string => {
  if (!url) return CLOUD_API_DEFAULT;
  let u = String(url).trim().split(/\s+\|\|/)[0]?.trim() ?? '';
  if (!u) return CLOUD_API_DEFAULT;
  u = u.replace(/^["']|["']$/g, '');
  u = u.endsWith('/') ? u.slice(0, -1) : u;
  if (u.toLowerCase().endsWith('/api')) {
    u = u.slice(0, -4);
    if (u.endsWith('/')) u = u.slice(0, -1);
  }
  return u;
};

export const getViteApiBaseUrl = (): string =>
  normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL ?? CLOUD_API_DEFAULT);

export function getServerMode(): ServerMode {
  try {
    const saved = localStorage.getItem(STORAGE_SERVER_MODE_KEY);
    if (saved === 'cloud' || saved === 'local' || saved === 'custom') {
      return saved;
    }
  } catch {
    // ignore
  }
  return 'cloud';
}

export function getCustomApiUrl(): string {
  try {
    return localStorage.getItem(STORAGE_CUSTOM_URL_KEY) || LOCAL_API_DEFAULT;
  } catch {
    return LOCAL_API_DEFAULT;
  }
}

let resolvedApiBaseUrl: string | null = null;

export function getApiBaseUrl(): string {
  if (resolvedApiBaseUrl) return resolvedApiBaseUrl;

  const mode = getServerMode();
  if (mode === 'cloud') {
    resolvedApiBaseUrl = CLOUD_API_DEFAULT;
  } else if (mode === 'local') {
    resolvedApiBaseUrl = LOCAL_API_DEFAULT;
  } else {
    resolvedApiBaseUrl = normalizeBaseUrl(getCustomApiUrl());
  }
  return resolvedApiBaseUrl;
}

export async function setServerMode(mode: ServerMode, customUrl?: string): Promise<string> {
  let targetUrl = CLOUD_API_DEFAULT;
  if (mode === 'local') {
    targetUrl = LOCAL_API_DEFAULT;
  } else if (mode === 'custom') {
    targetUrl = normalizeBaseUrl(customUrl || getCustomApiUrl());
  }

  resolvedApiBaseUrl = targetUrl;

  try {
    localStorage.setItem(STORAGE_SERVER_MODE_KEY, mode);
    localStorage.setItem(STORAGE_ACTIVE_URL_KEY, targetUrl);
    if (customUrl) {
      localStorage.setItem(STORAGE_CUSTOM_URL_KEY, targetUrl);
    }
  } catch {
    // ignore
  }

  try {
    if (window.electronAPI?.setApiBaseUrl) {
      await window.electronAPI.setApiBaseUrl(targetUrl);
    }
  } catch (err) {
    console.warn('Failed to notify Electron of new apiBaseUrl:', err);
  }

  return targetUrl;
}

export async function initApiBaseUrl(): Promise<string> {
  let url = getApiBaseUrl();

  // In production builds, if no explicit user preference is stored, check api-base.json
  if (!import.meta.env.DEV) {
    try {
      const savedMode = localStorage.getItem(STORAGE_SERVER_MODE_KEY);
      if (!savedMode) {
        const res = await fetch(`${import.meta.env.BASE_URL}api-base.json`, { cache: 'no-store' });
        if (res.ok) {
          const data = (await res.json()) as { apiBase?: string };
          if (typeof data.apiBase === 'string' && data.apiBase.trim()) {
            const fetched = normalizeBaseUrl(data.apiBase);
            if (!fetched.includes('127.0.0.1') && !fetched.includes('localhost')) {
              url = fetched;
            }
          }
        }
      }
    } catch {
      // keep fallback
    }
  }

  resolvedApiBaseUrl = url;

  try {
    if (window.electronAPI?.setApiBaseUrl) {
      await window.electronAPI.setApiBaseUrl(url);
    }
  } catch (err) {
    console.warn('Failed to notify Electron of initial apiBaseUrl:', err);
  }

  return url;
}

