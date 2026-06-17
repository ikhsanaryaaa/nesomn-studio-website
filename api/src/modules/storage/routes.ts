import { Elysia } from 'elysia';
import { readFile } from 'node:fs/promises';
import { verifyToken, resolveLocalKey } from '../../lib/storage/local-fs.ts';
import { AppError } from '../../middleware/error.ts';

/**
 * Streaming file untuk driver storage local-fs.
 * Akses divalidasi lewat token HMAC ber-TTL (lihat local-fs.ts).
 * No-op efektif bila STORAGE_DRIVER=r2 (R2 pakai presigned URL langsung).
 */
export const storageRoutes = new Elysia().get(
  '/files/:key',
  async ({ params, query, set }) => {
    if ((process.env.STORAGE_DRIVER ?? 'local') !== 'local') {
      throw new AppError('NOT_FOUND', 'Endpoint file hanya untuk storage lokal.', 404);
    }

    const key = decodeURIComponent(params.key);
    const exp = Number((query as Record<string, string | undefined>).exp);
    const token = (query as Record<string, string | undefined>).token ?? '';
    if (!exp || !verifyToken(key, exp, token)) {
      throw new AppError('FORBIDDEN', 'Token download tidak valid atau kedaluwarsa.', 403);
    }

    try {
      const bytes = await readFile(resolveLocalKey(key));
      set.headers['cache-control'] = 'private, max-age=300';
      return new Response(bytes);
    } catch {
      throw new AppError('NOT_FOUND', 'File tidak ditemukan.', 404);
    }
  },
);
