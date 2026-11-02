import { test, expect } from 'bun:test';
import { providerRequest } from '../../api/src/lib/outbound.ts';
test.skipIf(process.env.NESOMN_OUTBOUND_PROBE !== '1')(
  'Bun HTTPS pinned lookup reaches example.com without credentials',
  async () => {
    process.env.AI_PROVIDER_HOSTS = 'example.com';
    const response = await providerRequest('https://example.com');
    expect(response.status).toBe(200);
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0);
  },
  20000,
);
