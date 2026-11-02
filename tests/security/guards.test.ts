import { expect, test } from 'bun:test';
import { createHmac } from 'node:crypto';
import { resolveGateway } from '../../api/src/modules/billing/gateway.ts';
import { StripeGateway } from '../../api/src/modules/billing/gateways/stripe.ts';
import { StubGateway } from '../../api/src/modules/billing/gateways/stub.ts';
import { resolveProvider } from '../../api/src/modules/ai/provider.ts';
import { clientIp, assertRequestOrigin } from '../../api/src/middleware/request-security.ts';
import { validateStorageKey } from '../../api/src/lib/storage/key.ts';
import { signToken, verifyToken } from '../../api/src/lib/storage/local-fs.ts';

async function withEnv(
  values: Record<string, string | undefined>,
  run: () => Promise<void> | void,
) {
  const old = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    await run();
  } finally {
    for (const [key, value] of Object.entries(old)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('production never resolves stub payments or missing providers into a simulation', async () => {
  await withEnv(
    {
      NODE_ENV: 'production',
      ALLOW_PAYMENT_STUB: 'true',
      ALLOW_AI_STUB: 'true',
      STRIPE_SECRET_KEY: undefined,
      PAKASIR_API_KEY: undefined,
    },
    async () => {
      for (const gateway of ['stub', 'stripe', 'pakasir', 'unknown'] as const)
        await expect(resolveGateway(gateway as never)).rejects.toThrow();
      await expect(
        new StubGateway().createCheckout({
          id: 'fixture',
          amountIdr: 1000,
          amountUsd: 1,
          currency: 'IDR',
          description: 'Demo / Sample',
        }),
      ).rejects.toThrow();
      await expect(
        resolveProvider({
          key: 'sample-missing',
          kind: 'image',
          tab: 'scene',
          modelName: 'sample',
          baseUrl: null,
          apiKeyEncrypted: null,
        }),
      ).rejects.toThrow();
    },
  );
  await withEnv({ NODE_ENV: 'test', ALLOW_PAYMENT_STUB: undefined }, async () => {
    await expect(resolveGateway('stub')).rejects.toThrow();
  });
});

test('unsigned stub webhook is never a payment confirmation even in test mode', async () => {
  await expect(
    new StubGateway().verifyWebhook('{"orderId":"fixture","status":"paid"}', null),
  ).rejects.toThrow();
});

test('Stripe verification authenticates raw bytes/timestamp and only paid checkout events', async () => {
  const secret = 'synthetic-stripe-webhook-secret-not-production';
  await withEnv({ STRIPE_SECRET_KEY: 'synthetic-key', STRIPE_WEBHOOK_SECRET: secret }, async () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      id: 'evt_sample',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_sample',
          mode: 'payment',
          client_reference_id: '8fa6a9e1-ad74-4314-bc68-7ca1b2a8f901',
          payment_status: 'paid',
          amount_total: 1234,
          currency: 'usd',
        },
      },
    };
    const raw = JSON.stringify(payload);
    const signature = (body: string, time = now) =>
      `t=${time},v1=${createHmac('sha256', secret).update(`${time}.${body}`).digest('hex')}`;
    const gateway = new StripeGateway();
    await expect(gateway.verifyWebhook(raw, 'fake-present-header')).rejects.toThrow();
    await expect(gateway.verifyWebhook(raw + ' ', signature(raw))).rejects.toThrow();
    await expect(gateway.verifyWebhook(raw, signature(raw, now - 301))).rejects.toThrow();
    await expect(gateway.verifyWebhook(raw, signature(raw, now + 301))).rejects.toThrow();
    expect(await gateway.verifyWebhook(raw, signature(raw))).toMatchObject({
      eventId: 'evt_sample',
      gatewayRef: 'cs_sample',
      status: 'paid',
      amountMinor: 1234,
      currency: 'USD',
    });
    const unpaid = JSON.stringify({
      ...payload,
      data: { object: { ...payload.data.object, payment_status: 'unpaid' } },
    });
    expect(await gateway.verifyWebhook(unpaid, signature(unpaid))).toBeNull();
    const other = JSON.stringify({ ...payload, type: 'customer.created' });
    expect(await gateway.verifyWebhook(other, signature(other))).toBeNull();
  });
});

test('origin gate protects cookie mutations, permits verified-callback boundary, and ignores forged proxy headers by default', async () => {
  await withEnv(
    {
      NODE_ENV: 'production',
      CLIENT_URL: 'https://studio.example.test',
      ADMIN_URL: 'https://studio.example.test',
      TRUST_PROXY: undefined,
    },
    () => {
      expect(() =>
        assertRequestOrigin(
          new Request('https://studio.example.test/auth/login', { method: 'POST' }),
        ),
      ).toThrow();
      expect(() =>
        assertRequestOrigin(
          new Request('https://studio.example.test/projects', {
            method: 'POST',
            headers: { origin: 'https://evil.test' },
          }),
        ),
      ).toThrow();
      expect(() =>
        assertRequestOrigin(
          new Request('https://studio.example.test/projects', {
            method: 'POST',
            headers: { origin: 'https://studio.example.test' },
          }),
        ),
      ).not.toThrow();
      expect(() =>
        assertRequestOrigin(
          new Request('https://studio.example.test/billing/webhook/stripe', { method: 'POST' }),
        ),
      ).not.toThrow();
      expect(
        clientIp(
          new Request('http://localhost', { headers: { 'x-forwarded-for': '203.0.113.99' } }),
          '127.0.0.1',
        ),
      ).toBe('127.0.0.1');
    },
  );
  await withEnv({ TRUST_PROXY: '1' }, () => {
    expect(
      clientIp(new Request('http://localhost', { headers: { 'x-forwarded-for': '203.0.113.99' } })),
    ).toBe('203.0.113.99');
    expect(
      clientIp(
        new Request('http://localhost', {
          headers: { 'x-forwarded-for': '203.0.113.99, 127.0.0.1' },
        }),
        '10.0.0.2',
      ),
    ).toBe('10.0.0.2');
  });
});

test('private storage keys and HMAC reject traversal, invalid/expired/nonfinite tokens', () => {
  expect(validateStorageKey('assets/original-file.glb')).toBe('assets/original-file.glb');
  for (const key of [
    '../outside',
    'assets/../../outside',
    '/absolute',
    'C:\\outside',
    'assets\\..\\outside',
    'assets/%2e%2e/outside',
    'https://evil.test/file',
    'assets/\0file',
  ])
    expect(() => validateStorageKey(key)).toThrow();
  const expiry = Date.now() + 10000;
  expect(verifyToken('assets/file', expiry, signToken('assets/file', expiry))).toBe(true);
  expect(verifyToken('assets/file', expiry, 'bad')).toBe(false);
  expect(verifyToken('assets/file', expiry, signToken('assets/other', expiry))).toBe(false);
  expect(verifyToken('assets/file', Infinity, signToken('assets/file', Infinity))).toBe(false);
  expect(verifyToken('assets/file', Date.now() - 1, 'a'.repeat(64))).toBe(false);
});
