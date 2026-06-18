import { Elysia } from 'elysia';
import { AppError } from './error.ts';

/**
 * Rate limit sederhana berbasis in-memory sliding window. Cukup untuk
 * melindungi endpoint sensitif (auth, checkout, webhook) dari abuse dasar.
 * Untuk skala multi-instance, ganti store ke Redis. Kunci = IP + path.
 */

type Bucket = { count: number; resetAt: number };
const store = new Map<string, Bucket>();

/** Bersihkan bucket kedaluwarsa sesekali agar map tidak tumbuh tanpa batas. */
function sweep(now: number) {
  if (store.size < 5000) return;
  for (const [key, b] of store) {
    if (b.resetAt < now) store.delete(key);
  }
}

export type RateLimitOptions = {
  /** Maksimum request per window. */
  max: number;
  /** Panjang window dalam milidetik. */
  windowMs: number;
};

/**
 * Buat plugin rate limit. Terapkan ke grup route sensitif via .use().
 * Mengembalikan 429 saat melebihi batas.
 */
export function rateLimit(name: string, opts: RateLimitOptions) {
  return new Elysia({ name: `rate-limit-${name}` }).onBeforeHandle(
    { as: 'global' },
    ({ request, server }) => {
      const now = Date.now();
      sweep(now);

      const ip =
        server?.requestIP(request)?.address ??
        request.headers.get('x-forwarded-for') ??
        'unknown';
      const url = new URL(request.url);
      const key = `${name}:${ip}:${url.pathname}`;

      const bucket = store.get(key);
      if (!bucket || bucket.resetAt < now) {
        store.set(key, { count: 1, resetAt: now + opts.windowMs });
        return;
      }
      bucket.count += 1;
      if (bucket.count > opts.max) {
        throw new AppError('RATE_LIMITED', 'Terlalu banyak permintaan. Coba lagi nanti.', 429);
      }
    },
  );
}
