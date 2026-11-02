import { Elysia } from 'elysia';
import { clientIp } from './request-security.ts';
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

      const ip = clientIp(request, server?.requestIP(request)?.address);
      const url = new URL(request.url);
      const sensitive = /\/(auth|billing)(\/|$)/.test(url.pathname);
      const limit = sensitive ? Math.min(opts.max, 30) : opts.max;
      const key = `${name}:${ip}:${sensitive ? url.pathname.split('/').slice(0, 3).join('/') : 'all'}`;

      const bucket = store.get(key);
      if (!bucket || bucket.resetAt < now) {
        if (store.size >= 10000)
          throw new AppError('RATE_LIMITED', 'Terlalu banyak permintaan.', 429);
        store.set(key, { count: 1, resetAt: now + opts.windowMs });
        return;
      }
      bucket.count += 1;
      if (bucket.count > limit) {
        throw new AppError('RATE_LIMITED', 'Terlalu banyak permintaan. Coba lagi nanti.', 429);
      }
    },
  );
}
