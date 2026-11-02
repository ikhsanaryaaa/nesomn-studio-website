import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { spawnSync } from 'node:child_process';
import { createHmac, randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import http from 'node:http';
import process from 'node:process';
import { test } from 'node:test';
import { createTestInvocation } from '../../scripts/test-baseline.mjs';

if (process.env.NESOMN_DISPOSABLE_TESTS !== '1')
  throw new Error(
    'Acceptance requires disposable Docker lab and NESOMN_DISPOSABLE_TESTS=1; see docs/testing.md',
  );
const base = 'http://127.0.0.1:18080';
let cookie = '';
const request = (path, init = {}) =>
  fetch(base + path, {
    ...init,
    headers: { cookie, origin: base, ...init.headers },
    signal: AbortSignal.timeout(10000),
  });
const json = (body) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});
function fixture(action, id) {
  const { env } = createTestInvocation('unit', process.env);
  env.NESOMN_DISPOSABLE_TESTS = '1';
  const result = spawnSync(
    'bun',
    ['--no-env-file', '--no-install', 'tests/deployment/data-fixture.ts', action, id],
    { env, encoding: 'utf8', windowsHide: true, timeout: 15000 },
  );
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout.trim());
}

test('production gateway acceptance (isolated local lab only)', { timeout: 60000 }, async (t) => {
  const email = `revision-phase3-${randomUUID()}@deployment.invalid`;
  const password = 'Synthetic-password-for-disposable-tests-only';
  let userId;
  try {
    await t.test('health, API404, assets and SPA deep links', async () => {
      assert.equal((await request('/health/ready')).status, 200);
      assert.equal((await request('/api/health')).status, 200);
      for (const path of ['/api', '/api/unknown', '/api/admin/not-a-resource']) {
        const response = await request(path, { headers: { accept: 'text/html' } });
        assert.equal(response.status, 404);
        assert.match(response.headers.get('content-type'), /application\/json/);
      }
      for (const path of [
        '/',
        '/pricing',
        '/marketplace',
        '/editor/scene/legacy',
        '/editor/3d/legacy',
        '/account',
        '/admin/login',
        '/admin/assets-3d/edit/legacy',
      ]) {
        const response = await request(path);
        assert.equal(response.status, 200, path);
        assert.match(response.headers.get('content-type'), /text\/html/);
      }
      for (const path of [
        '/assets/missing.js',
        '/admin/assets/missing.js',
        '/.env',
        '/missing.svg',
        '/not-a-route',
      ])
        assert.equal((await request(path)).status, 404, path);
      const admin = await (await request('/admin/login')).text();
      const script = admin.match(/src="(\/admin\/assets\/[^" ]+\.js)"/)[1];
      const asset = await request(script);
      assert.equal(asset.status, 200);
      assert.match(asset.headers.get('cache-control'), /immutable/);
      assert.equal((await request(script, { method: 'HEAD' })).status, 200);
      assert.equal((await request('/nesomn-logo-white.svg')).status, 200);
      const oversized = await new Promise((resolve, reject) => {
        const req = http.request(
          `${base}/api/admin/uploads`,
          { method: 'POST', headers: { 'content-length': 111 * 1024 * 1024 } },
          (response) => {
            response.resume();
            resolve(response.statusCode);
          },
        );
        req.setTimeout(5000, () => req.destroy(new Error('Oversize check timeout')));
        req.on('error', reject);
        req.end();
      });
      assert.equal(oversized, 413);
    });
    await t.test('auth cookies and server admin role survive /api mount', async () => {
      const registration = json({ email, password, name: 'Demo / Sample deployment test' });
      registration.headers['x-forwarded-for'] = '203.0.113.99';
      registration.headers['x-real-ip'] = '203.0.113.99';
      const response = await request('/api/auth/register', registration);
      assert.equal(response.status, 201);
      const setCookie = response.headers.get('set-cookie');
      assert.match(setCookie, /HttpOnly/i);
      assert.match(setCookie, /Secure/i);
      cookie = setCookie.split(';')[0];
      userId = (await response.json()).id;
      const session = fixture('session-ip', userId);
      assert.ok(session.ip);
      assert.notEqual(session.ip, '203.0.113.99', 'Gateway must overwrite untrusted forwarded IP');
      assert.equal((await request('/api/me')).status, 200);
      assert.equal((await request('/api/admin/users')).status, 403);
      fixture('promote', userId);
      const login = await request('/api/auth/login', json({ email, password }));
      assert.equal(login.status, 200);
      cookie = login.headers.get('set-cookie').split(';')[0];
      assert.equal((await request('/api/admin/users')).status, 200);
    });
    await t.test('real upload and signed download use persistent local storage', async () => {
      const form = new FormData();
      const sample = fixture('sample-png', userId);
      const bytes = Buffer.from(sample.bytes, 'base64');
      form.set('file', new Blob([bytes], { type: 'image/png' }), 'sample-upload.png');
      const response = await request('/api/admin/uploads/?kind=file', {
        method: 'POST',
        body: form,
      });
      assert.equal(response.status, 200);
      const upload = await response.json();
      assert.ok(upload.fileKey.startsWith('assets/'));
      // This is an upload transport fixture, not a valid/demo GLB or a store product.
      const download = await request(upload.previewUrl);
      assert.equal(download.status, 200);
      assert.ok((await download.arrayBuffer()).byteLength > 0);
      writeFileSync(
        '.cache/revision-phase-3/storage-probe.json',
        JSON.stringify({
          previewUrl: upload.previewUrl,
          expectedBase64: Buffer.from(
            await (await request(upload.previewUrl)).arrayBuffer(),
          ).toString('base64'),
        }),
      );
      const badToken = new URL(upload.previewUrl, base);
      badToken.searchParams.set('token', 'invalid');
      assert.equal((await fetch(badToken)).status, 403);
      const previewForm = new FormData();
      previewForm.set(
        'file',
        new Blob([Buffer.from(sample.bytes, 'base64')], { type: 'image/png' }),
        'sample-preview.png',
      );
      const previewResponse = await request('/api/admin/uploads/', {
        method: 'POST',
        body: previewForm,
      });
      assert.equal(previewResponse.status, 200);
      const preview = await previewResponse.json();
      assert.ok(
        preview.thumbKey.endsWith('.thumb.webp'),
        'Sharp thumbnail must work in production image',
      );
      assert.equal((await request(preview.previewUrl)).status, 200);
    });
    await t.test(
      'production never accepts simulated payment/provider and rejects cross-site mutations',
      async () => {
        const { providerId } = fixture('prepare-ai', userId);
        const ai = await request(
          '/api/ai/jobs',
          json({
            providerId,
            tab: 'scene',
            input: { prompt: 'Demo / Sample must be rejected', aspect: '1:1' },
          }),
        );
        assert.equal(ai.status, 503);
        assert.equal(
          (await request('/api/billing/checkout', json({ type: 'topup', gateway: 'stub' }))).status,
          503,
        );
        assert.equal(
          (await request('/api/billing/dev/pay/' + randomUUID(), { method: 'POST' })).status,
          503,
        );
        assert.equal(
          (
            await request('/api/billing/webhook/stripe', {
              method: 'POST',
              headers: { 'content-type': 'application/json', 'stripe-signature': 'forged' },
              body: '{}',
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await request('/api/auth/login', {
              ...json({ email, password }),
              headers: { 'content-type': 'application/json', origin: 'https://evil.test' },
            })
          ).status,
          403,
        );
        const legacy = fixture('prepare-payment', userId);
        const raw = JSON.stringify({
          id: 'sample-phase4-' + userId,
          type: 'checkout.session.completed',
          data: {
            object: {
              id: legacy.gatewayRef,
              client_reference_id: legacy.orderId,
              mode: 'payment',
              payment_status: 'paid',
              currency: 'idr',
              amount_total: 10000,
            },
          },
        });
        const timestamp = Math.floor(Date.now() / 1000);
        const signature =
          't=' +
          timestamp +
          ',v1=' +
          createHmac('sha256', 'synthetic-deployment-stripe-webhook-secret')
            .update(timestamp + '.' + raw)
            .digest('hex');
        const verified = await fetch(base + '/api/billing/webhook/stripe', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'stripe-signature': signature },
          body: raw,
        });
        assert.equal(verified.status, 202);
        assert.equal((await verified.json()).outcome, 'review_required');
        assert.deepEqual(fixture('payment-status', userId).statuses, ['pending']);
        const form = new FormData();
        form.set('file', new Blob(['<script>bad</script>'], { type: 'image/png' }), 'bad.png');
        assert.equal(
          (await request('/api/admin/uploads/', { method: 'POST', body: form })).status,
          400,
        );
        assert.equal((await (await request('/api/ai/credit')).json()).balance, 100);
      },
    );
  } finally {
    if (userId) fixture('cleanup', userId);
  }
});
