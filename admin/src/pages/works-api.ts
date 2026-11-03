export type WorkMedia = { id: string; name: string; mimeType: string; url: string };
export type WorkGalleryItem = {
  mediaId: string;
  alt: string;
  posterMediaId: string | null;
  media?: WorkMedia;
  poster?: WorkMedia | null;
};
export type WorkDraft = {
  slug: string;
  title: string;
  description: string;
  projectDate: string | null;
  client: string | null;
  status: 'draft' | 'published';
  isSample: boolean;
  coverMediaId: string | null;
  linkLabel: string | null;
  linkUrl: string | null;
  gallery: WorkGalleryItem[];
};
export type WorkRecord = WorkDraft & {
  id: string;
  revision: number;
  updatedAt: string;
  cover?: WorkMedia | null;
};
export class WorkRequestError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'REQUEST_FAILED',
  ) {
    super(message);
  }
}
const apiBase = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
export async function workRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(apiBase + '/admin/works' + path, {
    ...init,
    credentials: 'include',
    headers:
      init.body instanceof FormData
        ? init.headers
        : { 'Content-Type': 'application/json', ...init.headers },
  });
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new WorkRequestError(response.status, 'The server returned an invalid response.');
  }
  if (!response.ok) {
    const data = body as { error?: { message?: string; code?: string } };
    throw new WorkRequestError(
      response.status,
      data?.error?.message || 'Unable to complete the request.',
      data?.error?.code,
    );
  }
  return body as T;
}
export async function uploadWorkMedia(file: File, signal?: AbortSignal): Promise<WorkMedia> {
  if (!['image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/webm'].includes(file.type))
    throw new Error('Choose PNG, JPEG, WebP, MP4 or WebM.');
  const limit = file.type.startsWith('video/') ? 100 : 20;
  if (file.size > limit * 1024 * 1024)
    throw new Error('The file exceeds the ' + limit + ' MB limit.');
  const body = new FormData();
  body.set('file', file);
  return workRequest<WorkMedia>('/media', { method: 'POST', body, signal });
}
export function workPayload(draft: WorkDraft): WorkDraft {
  const {
    slug,
    title,
    description,
    projectDate,
    client,
    status,
    isSample,
    coverMediaId,
    linkLabel,
    linkUrl,
  } = draft;
  return {
    slug,
    title,
    description,
    projectDate,
    client,
    status,
    isSample,
    coverMediaId,
    linkLabel,
    linkUrl,
    gallery: draft.gallery.map(({ mediaId, alt, posterMediaId }) => ({
      mediaId,
      alt,
      posterMediaId,
    })),
  };
}
