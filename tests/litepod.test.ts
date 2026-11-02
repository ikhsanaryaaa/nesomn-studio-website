import { expect, test } from 'bun:test';
import { startWorkerHealth } from '../worker/src/health-http';
test('worker health is optional and rejects invalid ports', () => {
  expect(startWorkerHealth(undefined, async () => true)).toBeUndefined();
  for (const value of ['0', '80', '65536', '3001bad', '3001.5', '-1'])
    expect(() => startWorkerHealth(value, async () => true)).toThrow('WORKER_HEALTH_PORT');
});
test('private worker HTTP listener fails closed and exposes no dependency details', async () => {
  const reserve = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch: () => new Response() });
  const port = reserve.port!;
  await reserve.stop(true);
  let healthy = false,
    failed = false;
  const server = startWorkerHealth(String(port), async () => {
    if (failed) throw new Error('secret connection string');
    return healthy;
  })!;
  const base = 'http://127.0.0.1:' + port;
  try {
    expect((await fetch(base + '/health/live')).status).toBe(200);
    const unready = await fetch(base + '/health/ready');
    expect(unready.status).toBe(503);
    expect(unready.headers.get('cache-control')).toBe('no-store');
    healthy = true;
    expect((await fetch(base)).status).toBe(200);
    expect(await (await fetch(base + '/health/ready')).json()).toEqual({ ok: true });
    expect((await fetch(base + '/jobs')).status).toBe(404);
    expect((await fetch(base, { method: 'POST' })).status).toBe(405);
    expect(await (await fetch(base, { method: 'HEAD' })).text()).toBe('');
    failed = true;
    const failure = await fetch(base + '/health/ready');
    expect(failure.status).toBe(503);
    expect(await failure.text()).not.toContain('secret');
  } finally {
    await server.stop(true);
  }
});
