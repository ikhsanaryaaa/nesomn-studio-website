import { Elysia } from 'elysia';
import { realpath, stat } from 'node:fs/promises';
import { extname, isAbsolute, relative, resolve } from 'node:path';

type Options = {
  clientDir: string;
  adminDir: string;
  domains?: { landing: string; shop: string; admin: string; api: string };
  readiness: () => Promise<{ database: boolean; redis: boolean }>;
};

const clientRoutes =
  /^(?:\/(?:demo\/3d|landing|dashboard|login|register|pricing|marketplace|bundle-builder|library|account|checkout)|\/marketplace\/[^/.]+|\/editor\/(?:projects|(?:scene|3d)(?:\/[^/.]+)?))\/?$/;
const marketingRoutes =
  /^\/(?:about|works(?:\/[a-z0-9][a-z0-9-]{0,159})?|demo\/works\/nesomn-studio-kit)\/?$/;
const adminRoutes =
  /^\/admin\/(?:login|works|assets|assets-3d|bundles|plans|credit-packs|users|subscriptions|credit-ledger|ai-providers|usage|sessions|audit-logs)(?:\/(?:create|(?:edit|show)\/[^/.]+))?\/?$/;

function notFound() {
  return new Response('Not Found', {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

async function staticFile(root: string, name: string, request: Request, immutable = false) {
  try {
    const canonicalRoot = await realpath(root);
    const filePath = await realpath(resolve(canonicalRoot, name));
    const path = relative(canonicalRoot, filePath);
    if (path.startsWith('..') || isAbsolute(path) || !(await stat(filePath)).isFile()) return null;
    const file = Bun.file(filePath);
    return new Response(request.method === 'HEAD' ? null : file, {
      headers: {
        'content-type': file.type,
        'content-length': String(file.size),
        'cache-control': immutable
          ? 'public, max-age=31536000, immutable'
          : extname(filePath) === '.html'
            ? 'no-cache'
            : 'public, max-age=3600',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch {
    return null;
  }
}

/** Keep raw API routes intact; only this production shell owns the /api namespace. */
export function createWebApp(
  apiFetch: (request: Request) => Response | Promise<Response>,
  options: Options,
) {
  return (
    new Elysia()
      .get('/health/live', () => ({ status: 'ok', uptime: process.uptime() }))
      .get('/health/ready', async ({ set }) => {
        const checks = await options.readiness();
        const ready = checks.database && checks.redis;
        set.status = ready ? 200 : 503;
        set.headers['cache-control'] = 'no-store';
        return { status: ready ? 'ready' : 'not_ready', checks };
      })
      .mount('/api', apiFetch)
      // Existing signed local URLs are root-relative. They must still pass API HMAC checks.
      .all('/files/*', ({ request }) => apiFetch(request))
      .all('/*', async ({ request }) => {
        if (!['GET', 'HEAD'].includes(request.method))
          return new Response('Method Not Allowed', {
            status: 405,
            headers: { allow: 'GET, HEAD' },
          });
        let path: string;
        try {
          path = decodeURIComponent(new URL(request.url).pathname);
        } catch {
          return new Response('Bad Request', { status: 400 });
        }
        if (/[\\\0%]/.test(path) || path.split('/').some((part) => part.startsWith('.')))
          return notFound();
        const domains = options.domains;
        const host = new URL(request.url).hostname;
        const on = (value: string) => new URL(value).hostname === host;
        const adminHost = !!domains && on(domains.admin);
        if (domains && on(domains.api)) return notFound();
        if (domains && on(domains.shop) && marketingRoutes.test(path)) {
          const target = new URL(domains.landing);
          target.pathname = path;
          target.search = new URL(request.url).search;
          return new Response(null, { status: 308, headers: { location: target.toString() } });
        }
        if (
          domains &&
          on(domains.landing) &&
          (clientRoutes.test(path) || path === '/admin' || path.startsWith('/admin/'))
        ) {
          const target = path.startsWith('/admin') ? new URL(domains.admin) : new URL(domains.shop);
          target.pathname = path.startsWith('/admin') ? path.slice(6) || '/' : path;
          target.search = new URL(request.url).search;
          return new Response(null, { status: 308, headers: { location: target.toString() } });
        }
        if (adminHost && (path === '/admin' || (path.startsWith('/admin/') && !extname(path)))) {
          const target = new URL(domains!.admin);
          target.pathname = path.slice(6) || '/';
          target.search = new URL(request.url).search;
          return new Response(null, { status: 308, headers: { location: target.toString() } });
        }
        if (
          domains &&
          on(domains.shop) &&
          (path === '/admin' || path.startsWith('/admin/')) &&
          !extname(path)
        ) {
          const target = new URL(domains.admin);
          target.pathname = path.slice(6) || '/';
          target.search = new URL(request.url).search;
          return new Response(null, { status: 308, headers: { location: target.toString() } });
        }
        if (domains && on(domains.landing) && path === '/') {
          return (await staticFile(options.clientDir, 'landing/index.html', request)) ?? notFound();
        }
        if (adminHost && !path.startsWith('/admin/')) {
          const asset = await staticFile(
            options.adminDir,
            path.slice(1),
            request,
            path.startsWith('/assets/'),
          );
          if (asset) return asset;
          if (path !== '/' && !adminRoutes.test('/admin' + path)) return notFound();
          return (await staticFile(options.adminDir, 'index.html', request)) ?? notFound();
        }
        if (path === '/admin')
          return new Response(null, { status: 308, headers: { location: '/admin/' } });
        const admin = path.startsWith('/admin/');
        const root = admin ? options.adminDir : options.clientDir;
        const name = path.slice(admin ? 7 : 1);
        const asset = await staticFile(root, name, request, name.startsWith('assets/'));
        if (asset) return asset;
        if (/^\/nesomn-logo-(?:white|black)\.svg$/.test(path)) {
          return (await staticFile(options.adminDir, path.slice(1), request)) ?? notFound();
        }
        if (
          extname(path) ||
          (path !== '/' &&
            path !== '/admin/' &&
            !clientRoutes.test(path) &&
            !adminRoutes.test(path) &&
            !marketingRoutes.test(path))
        )
          return notFound();
        // Prefer actual prerendered HTML over the client shell, preserving SEO metadata.
        return (
          (await staticFile(root, `${name.replace(/\/$/, '')}/index.html`, request)) ??
          (await staticFile(root, 'index.html', request)) ??
          notFound()
        );
      })
  );
}
