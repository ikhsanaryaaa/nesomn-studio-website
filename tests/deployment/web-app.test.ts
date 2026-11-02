import { afterAll, describe, expect, test } from 'bun:test';
import { Elysia } from '../../api/node_modules/elysia';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { createWebApp } from '../../api/src/web-app.ts';

const cache = resolve('.cache/revision-phase-3');
await mkdir(cache, { recursive: true });
const fixture = await mkdtemp(join(cache, 'static-test-'));
const clientDir = join(fixture, 'client');
const adminDir = join(fixture, 'admin');
await Promise.all([
  mkdir(join(clientDir, 'assets'), { recursive: true }),
  mkdir(join(clientDir, 'pricing'), { recursive: true }),
  mkdir(join(adminDir, 'assets'), { recursive: true }),
]);
for (const [file, body] of [
  [join(clientDir, 'index.html'), '<!doctype html><title>client-shell</title>'],
  [join(clientDir, 'pricing/index.html'), '<!doctype html><title>pricing-prerender</title>'],
  [join(clientDir, 'assets/app-abc123.js'), 'export const client = true;'],
  [join(adminDir, 'index.html'), '<!doctype html><title>admin-shell</title>'],
  [join(adminDir, 'assets/app-def456.js'), 'export const admin = true;'],
  [join(adminDir, 'nesomn-logo-white.svg'), '<svg/>'],
])
  await writeFile(file!, body!);

afterAll(async () => {
  if (!fixture.startsWith(cache + sep)) throw new Error('Fixture cleanup outside workspace');
  await rm(fixture, { recursive: true });
});

const api = new Elysia()
  .get('/health', () => ({ status: 'ok' }))
  .get('/admin/probe', () => ({ api: true }))
  .get('/query', ({ query }) => query)
  .post(
    '/auth/probe',
    ({ body }) =>
      new Response(JSON.stringify(body), {
        headers: {
          'content-type': 'application/json',
          'set-cookie': 'session=synthetic; HttpOnly; Secure; Path=/',
        },
      }),
  )
  .get('/files/:key', () => new Response('Forbidden', { status: 403 }))
  .onError(({ code, set }) => {
    set.status = code === 'NOT_FOUND' ? 404 : 500;
    return { error: { code } };
  });

let ready = true;
const web = createWebApp(api.fetch, {
  clientDir,
  adminDir,
  readiness: async () => ({ database: ready, redis: ready }),
});
const request = (path: string, init?: RequestInit) =>
  web.handle(new Request('http://localhost' + path, init));

describe('single app production routing', () => {
  test('preserves API prefix, query, body, cookie and legacy signed-file namespace', async () => {
    expect(await (await request('/api/health')).json()).toEqual({ status: 'ok' });
    expect(await (await request('/api/admin/probe')).json()).toEqual({ api: true });
    expect(await (await request('/api/query?keep=1')).json()).toEqual({ keep: '1' });
    const response = await request('/api/auth/probe?keep=1', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"synthetic":true}',
    });
    expect(await response.json()).toEqual({ synthetic: true });
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect((await request('/files/private.glb')).status).toBe(403);
  });
  test('unknown API returns JSON404 for navigation, POST and exact /api', async () => {
    for (const [path, method] of [
      ['/api/unknown', 'GET'],
      ['/api/missing', 'POST'],
      ['/api', 'GET'],
    ]) {
      const response = await request(path!, { method, headers: { accept: 'text/html' } });
      expect(response.status).toBe(404);
      expect(response.headers.get('content-type')).toContain('application/json');
      expect(await response.text()).not.toContain('<!doctype');
    }
  });
  test('known client/admin deep links and prerendered route serve correct HTML', async () => {
    for (const path of [
      '/',
      '/account',
      '/login?returnTo=/library',
      '/register',
      '/demo/3d',
      '/editor/scene/legacy',
      '/editor/3d/legacy',
      '/marketplace/item',
    ]) {
      const response = await request(path);
      expect(response.status).toBe(200);
      expect(await response.text()).toContain('client-shell');
    }
    expect(await (await request('/pricing')).text()).toContain('pricing-prerender');
    expect(await (await request('/admin/assets-3d/edit/old-project')).text()).toContain(
      'admin-shell',
    );
    expect((await request('/admin')).headers.get('location')).toBe('/admin/');
  });
  test('static files have types/cache/HEAD; root admin logo remains available', async () => {
    const asset = await request('/assets/app-abc123.js');
    expect(asset.headers.get('content-type')).toContain('javascript');
    expect(asset.headers.get('cache-control')).toContain('immutable');
    expect((await request('/account')).headers.get('cache-control')).toBe('no-cache');
    expect(await (await request('/nesomn-logo-white.svg')).text()).toBe('<svg/>');
    const head = await request('/admin/assets/app-def456.js', { method: 'HEAD' });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe('');
  });
  test('missing assets, unknown pages, private paths and traversal never return SPA', async () => {
    for (const path of [
      '/assets/missing.js',
      '/admin/assets/missing.css',
      '/missing.svg',
      '/not-a-page',
      '/.env',
      '/api/.env',
      '/%252e%252e/.env',
      '/assets/%5c..%5c.env',
    ]) {
      const response = await request(path);
      expect([400, 404]).toContain(response.status);
      expect(await response.text()).not.toContain('<!doctype');
    }
    expect((await request('/account', { method: 'POST' })).status).toBe(405);
  });
  test('liveness stays up while readiness reports dependency outage without secrets', async () => {
    ready = false;
    expect((await request('/health/live')).status).toBe(200);
    const response = await request('/health/ready');
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: 'not_ready',
      checks: { database: false, redis: false },
    });
    ready = true;
    expect((await request('/health/ready')).status).toBe(200);
  });
});
