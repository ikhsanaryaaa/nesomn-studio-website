import { API_BASE } from './site-config';
export type WorkMedia = {
  id: string;
  name: string;
  url: string;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp' | 'video/mp4' | 'video/webm';
  width?: number | null;
  height?: number | null;
};
export type PublicWork = {
  id: string;
  slug: string;
  title: string;
  description: string;
  projectDate: string | null;
  client: string | null;
  isSample: boolean;
  cover: WorkMedia | null;
  gallery: {
    mediaId: string;
    alt: string;
    posterMediaId: string | null;
    media: WorkMedia;
    poster: WorkMedia | null;
  }[];
  linkLabel: string | null;
  linkUrl: string | null;
};
export class PortfolioError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'PortfolioError';
  }
}
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw Error('Invalid portfolio response');
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number): string {
  if (typeof value !== 'string' || value.length > max) throw Error('Invalid portfolio text');
  return value;
}
export function safeWorkLink(value: string): boolean {
  try {
    const u = new URL(value);
    return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password;
  } catch {
    return false;
  }
}
function media(value: unknown): WorkMedia {
  const m = object(value),
    id = text(m.id, 36),
    url = text(m.url, 4096),
    mime = text(m.mimeType, 50);
  if (
    !uuid.test(id) ||
    !['image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/webm'].includes(mime)
  )
    throw Error('Invalid portfolio media');
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://local.invalid';
  const expected = new URL(API_BASE + '/works/media/' + id, origin),
    actual = new URL(url, expected.origin);
  if (
    actual.origin !== expected.origin ||
    actual.pathname !== expected.pathname ||
    actual.search ||
    actual.hash ||
    actual.username ||
    actual.password
  )
    throw Error('Untrusted portfolio media URL');
  return {
    id,
    name: text(m.name, 160),
    url: expected.toString(),
    mimeType: mime as WorkMedia['mimeType'],
    width: typeof m.width === 'number' ? m.width : null,
    height: typeof m.height === 'number' ? m.height : null,
  };
}
export function parsePublicWork(value: unknown): PublicWork {
  const w = object(value),
    id = text(w.id, 36),
    slug = text(w.slug, 160),
    title = text(w.title, 160);
  if (
    w.status !== 'published' ||
    !uuid.test(id) ||
    !/^[a-z0-9][a-z0-9-]{0,159}$/.test(slug) ||
    !title.trim() ||
    typeof w.isSample !== 'boolean' ||
    !Array.isArray(w.gallery) ||
    w.gallery.length > 40
  )
    throw Error('Invalid published work');
  const linkUrl = w.linkUrl === null ? null : text(w.linkUrl, 2048),
    linkLabel = w.linkLabel === null ? null : text(w.linkLabel, 80);
  if (!!linkUrl !== !!linkLabel || (linkUrl && !safeWorkLink(linkUrl)))
    throw Error('Invalid custom link');
  const projectDate = w.projectDate === null ? null : text(w.projectDate, 10);
  if (
    projectDate &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(projectDate) ||
      !Number.isFinite(Date.parse(projectDate)) ||
      new Date(projectDate).toISOString().slice(0, 10) !== projectDate)
  )
    throw Error('Invalid project date');
  const cover = w.cover === null ? null : media(w.cover);
  if (cover && !cover.mimeType.startsWith('image/')) throw Error('Invalid cover');
  return {
    id,
    slug,
    title,
    description: text(w.description, 20000),
    projectDate,
    client: w.client === null ? null : text(w.client, 160),
    isSample: w.isSample,
    cover,
    linkLabel,
    linkUrl,
    gallery: w.gallery.map((value) => {
      const item = object(value),
        file = media(item.media),
        poster = item.poster === null ? null : media(item.poster);
      if (
        item.mediaId !== file.id ||
        (poster && (!poster.mimeType.startsWith('image/') || file.mimeType.startsWith('image/'))) ||
        item.posterMediaId !== (poster?.id ?? null)
      )
        throw Error('Invalid gallery references');
      return {
        mediaId: file.id,
        alt: text(item.alt, 500),
        posterMediaId: poster?.id ?? null,
        media: file,
        poster,
      };
    }),
  };
}
async function request(path: string, signal?: AbortSignal) {
  const r = await fetch(API_BASE + path, { signal, credentials: 'omit' });
  if (!r.ok)
    throw new PortfolioError(
      r.status,
      r.status === 404 ? 'Work not found.' : 'Unable to load published works. Please try again.',
    );
  let json: unknown;
  try {
    json = await r.json();
  } catch {
    throw new PortfolioError(502, 'The portfolio response could not be read.');
  }
  return { json, total: r.headers.get('x-total-count') };
}
export const portfolioApi = {
  async list(page: number, signal?: AbortSignal): Promise<{ items: PublicWork[]; total: number }> {
    if (!Number.isSafeInteger(page) || page < 1) throw Error('Invalid page');
    const { json, total } = await request(
      '/works?_start=' + (page - 1) * 12 + '&_end=' + page * 12,
      signal,
    );
    if (
      !Array.isArray(json) ||
      total === null ||
      !Number.isSafeInteger(Number(total)) ||
      Number(total) < 0
    )
      throw Error('Invalid portfolio list response');
    return { items: json.map(parsePublicWork), total: Number(total) };
  },
  async detail(slug: string, signal?: AbortSignal): Promise<PublicWork> {
    if (!/^[a-z0-9][a-z0-9-]{0,159}$/.test(slug)) throw new PortfolioError(404, 'Work not found.');
    return parsePublicWork((await request('/works/' + encodeURIComponent(slug), signal)).json);
  },
};
