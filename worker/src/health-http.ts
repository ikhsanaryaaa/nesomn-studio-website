/** Optional private listener; never returns job, provider or dependency details. */
export function startWorkerHealth(port: string | undefined, ready: () => Promise<boolean>) {
  if (!port) return undefined;
  if (!/^\d+$/.test(port) || Number(port) < 1024 || Number(port) > 65535)
    throw new Error('WORKER_HEALTH_PORT must be an unprivileged port (1024-65535)');
  return Bun.serve({
    hostname: '0.0.0.0',
    port: Number(port),
    async fetch(request) {
      const path = new URL(request.url).pathname;
      const headers = { 'cache-control': 'no-store' };
      if (!['GET', 'HEAD'].includes(request.method))
        return new Response(null, { status: 405, headers: { ...headers, allow: 'GET, HEAD' } });
      if (path === '/health/live') return Response.json({ ok: true }, { headers });
      if (path !== '/' && path !== '/health/ready')
        return Response.json({ error: 'Not found' }, { status: 404, headers });
      let ok = false;
      try {
        ok = await ready();
      } catch {
        /* Fail closed without leaking secrets. */
      }
      return Response.json({ ok }, { status: ok ? 200 : 503, headers });
    },
  });
}
