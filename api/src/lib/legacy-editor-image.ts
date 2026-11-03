import { validateStorageKey } from './storage/key.ts';

/** Extract an identity only. Never fetch the supplied URL or trust its signature as authorization. */
export function legacyEditorImageKey(
  src: string,
  endpoint?: string,
  bucket?: string,
): string | null {
  try {
    const url = new URL(src, 'http://local.invalid');
    let key: string;
    if (
      url.pathname.startsWith('/files/') &&
      !url.username &&
      !url.password &&
      ((src.startsWith('/files/') && url.origin === 'http://local.invalid') ||
        (!!process.env.API_URL && url.origin === new URL(process.env.API_URL).origin)) &&
      url.searchParams.has('token') &&
      url.searchParams.has('exp')
    ) {
      key = decodeURIComponent(url.pathname.slice(7));
    } else {
      if (!endpoint || !bucket || !url.searchParams.has('X-Amz-Signature')) return null;
      const base = new URL(endpoint);
      if (url.protocol !== 'https:' || url.username || url.password) return null;
      const prefix = base.pathname.replace(/\/$/, '') + '/';
      if (url.origin === base.origin && url.pathname.startsWith(prefix + bucket + '/')) {
        key = decodeURIComponent(url.pathname.slice((prefix + bucket + '/').length));
      } else if (
        url.protocol === base.protocol &&
        url.host === bucket + '.' + base.host &&
        url.pathname.startsWith(prefix)
      ) {
        key = decodeURIComponent(url.pathname.slice(prefix.length));
      } else return null;
    }
    return validateStorageKey(key);
  } catch {
    return null;
  }
}

export const editorImagePath = (slug: string) =>
  '/api/catalog/editor-image/' + encodeURIComponent(slug);
