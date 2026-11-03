import { byteRange } from '../../lib/byte-range.ts';
import { Elysia } from 'elysia';
import { verifyToken, openLocalKey } from '../../lib/storage/local-fs.ts';
import { eq } from 'drizzle-orm';
import { db } from '../../db/client.ts';
import { media } from '../../db/schema/index.ts';
import { AppError } from '../../middleware/error.ts';

/**
 * Streaming file untuk driver storage local-fs.
 * Akses divalidasi lewat token HMAC ber-TTL (lihat local-fs.ts).
 * No-op efektif bila STORAGE_DRIVER=r2 (R2 pakai presigned URL langsung).
 */
export const storageRoutes = new Elysia().get('/files/:key', async ({ params, query, request }) => {
  if ((process.env.STORAGE_DRIVER ?? 'local') !== 'local') {
    throw new AppError('NOT_FOUND', 'The file endpoint is only available for local storage.', 404);
  }

  const key = params.key;
  const exp = Number((query as Record<string, string | undefined>).exp);
  const token = (query as Record<string, string | undefined>).token ?? '';
  if (!exp || !verifyToken(key, exp, token)) {
    throw new AppError('FORBIDDEN', 'The download token is invalid or has expired.', 403);
  }

  try {
    const file = await openLocalKey(key);
    const row = await db.query.media.findFirst({ where: eq(media.key, key) });
    const safeMime =
      row &&
      /^(image\/(png|jpeg|webp|gif)|video\/(mp4|webm)|model\/gltf(?:-binary|\+json)|font\/(otf|ttf))$/.test(
        row.mimeType,
      )
        ? row.mimeType
        : 'application/octet-stream';
    const maxAge = Math.max(0, Math.min(300, Math.floor((exp - Date.now()) / 1000)));
    const range = byteRange(request.headers.get('range'), file.size);
    if (range === 'invalid')
      return new Response(null, {
        status: 416,
        headers: { 'content-range': 'bytes */' + file.size, 'accept-ranges': 'bytes' },
      });
    return new Response(range ? file.slice(range.start, range.end + 1) : file, {
      status: range ? 206 : 200,
      headers: {
        'cache-control': `private, max-age=${maxAge}`,
        'content-type': safeMime,
        'accept-ranges': 'bytes',
        'content-length': String(range ? range.end - range.start + 1 : file.size),
        ...(range
          ? { 'content-range': 'bytes ' + range.start + '-' + range.end + '/' + file.size }
          : {}),
        'content-disposition': safeMime === 'application/octet-stream' ? 'attachment' : 'inline',
        'x-content-type-options': 'nosniff',
        'content-security-policy': "default-src 'none'; sandbox",
      },
    });
  } catch {
    throw new AppError('NOT_FOUND', 'File not found.', 404);
  }
});
