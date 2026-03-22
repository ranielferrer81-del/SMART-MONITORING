import { getViteApiBaseUrl, normalizeBaseUrl } from '../config/apiBase';

/**
 * Laravel may return a storage path, absolute URL, or inline base64 (data:image/...;base64,...).
 * The desktop app must pass through data URLs — older code only prefixed /storage/ and broke base64.
 */
export function resolveProfilePictureUrl(
  picture: string | null | undefined,
  apiBaseOverride?: string
): string | null {
  if (picture == null || typeof picture !== 'string') return null;
  const trimmed = picture.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:')) return trimmed;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;

  const base = normalizeBaseUrl(apiBaseOverride ?? getViteApiBaseUrl());
  if (trimmed.startsWith('/storage/')) return `${base}${trimmed}`;
  if (trimmed.startsWith('storage/')) return `${base}/${trimmed}`;
  if (trimmed.startsWith('/')) return `${base}${trimmed}`;
  return `${base}/storage/${trimmed}`;
}
