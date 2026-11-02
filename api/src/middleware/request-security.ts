import { Elysia } from 'elysia';
import { isIP } from 'node:net';
import { AppError } from './error.ts';

/** Forwarded IP is trusted only in the private app -> gateway deployment contract. */
export function clientIp(request: Request, peer?: string): string {
  const forwarded = request.headers.get('x-forwarded-for')?.trim();
  if (process.env.TRUST_PROXY === '1' && forwarded && isIP(forwarded)) return forwarded;
  return peer && isIP(peer) ? peer : 'unknown';
}

export function assertRequestOrigin(request: Request) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
  const path = new URL(request.url).pathname;
  // Signature verification is mandatory inside these handlers, not replaced by Origin.
  if (/^\/(?:api\/)?billing\/webhook\/(?:stripe|pakasir)\/?$/.test(path)) return;
  if (
    request.method === 'POST' &&
    (path === '/billing/qris/receipts' || path === '/api/billing/qris/receipts')
  )
    return; // Handler requires raw-body HMAC.
  const origin = request.headers.get('origin');
  const allowed = [
    process.env.CLIENT_URL || 'http://localhost:5173',
    process.env.ADMIN_URL || 'http://localhost:5174',
  ];
  if (
    (origin && !allowed.includes(origin)) ||
    (!origin &&
      (process.env.NODE_ENV === 'production' ||
        request.headers.get('sec-fetch-site') === 'cross-site'))
  ) {
    throw new AppError('INVALID_ORIGIN', 'Request origin is not allowed.', 403);
  }
}

export const requestSecurity = new Elysia({ name: 'request-security' }).onBeforeHandle(
  { as: 'global' },
  ({ request }) => assertRequestOrigin(request),
);
