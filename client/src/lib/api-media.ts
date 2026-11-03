import { API_BASE } from './site-config';
/** Keep persisted document URLs unchanged; resolve their display URL at the boundary. */
export function apiMediaUrl(src: string): string {
  return src.startsWith('/api/') ? API_BASE + src.slice(4) : src;
}
export function editorImageSlug(src: string): string | null {
  const prefix = '/api/catalog/editor-image/';
  const canonical = src.startsWith(API_BASE + '/catalog/editor-image/')
    ? prefix + src.slice((API_BASE + '/catalog/editor-image/').length)
    : src;
  if (!canonical.startsWith(prefix)) return null;
  const slug = canonical.slice(prefix.length);
  if (!slug || /[/?#]/.test(slug)) return null;
  try {
    return decodeURIComponent(slug);
  } catch {
    return null;
  }
}
