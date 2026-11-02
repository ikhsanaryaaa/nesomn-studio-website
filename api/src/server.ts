import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readRuntimeEnv } from './lib/runtime-env.ts';
import { checkReadiness } from './lib/readiness.ts';
import { createWebApp } from './web-app.ts';

// Validate before importing modules which open DB/Redis connections.
try {
  const config = readRuntimeEnv(process.env, 'app');
  const clientDir = fileURLToPath(new URL('../../client/dist/', import.meta.url));
  const adminDir = fileURLToPath(new URL('../../admin/dist/', import.meta.url));
  for (const dir of [clientDir, adminDir]) await access(`${dir}/index.html`, constants.R_OK);
  if (config.storageDriver === 'local') await access(config.storagePath, constants.W_OK);

  const [{ app: api }, { sql }, { aiQueue }] = await Promise.all([
    import('./index.ts'),
    import('./db/client.ts'),
    import('./modules/ai/queue.ts'),
  ]);
  const app = createWebApp(api.fetch, {
    clientDir,
    adminDir,
    readiness: () =>
      checkReadiness({
        database: () =>
          sql`SELECT users.disabled_at, ai_jobs.lease_token, ai_jobs.provider_ref, order_items.benefit_snapshot, subscriptions.benefits, credit_ledger.operation_key FROM users, ai_jobs, order_items, subscriptions, credit_ledger, credit_accounts, credit_lots, credit_allocations, ai_outbox, order_fulfillments, payment_events, payment_receipts, oauth_states, qris_invoices, qris_receipts, qris_reservations WHERE false`,
        redis: () => aiQueue.getWaitingCount(),
      }),
  }).listen({ hostname: '0.0.0.0', port: config.port, maxRequestBodySize: 110 * 1024 * 1024 });
  console.log(`App listening on port ${config.port}`);

  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    console.log('App shutting down');
    await app.stop();
    await aiQueue.close();
    await sql.end({ timeout: 5 });
    process.exit(0);
  };
  process.on('SIGTERM', () => {
    void shutdown();
  });
  process.on('SIGINT', () => {
    void shutdown();
  });
} catch (error) {
  // Validation errors contain field names only. Filesystem/connection objects may contain secrets.
  const message =
    error instanceof Error && /^(Environment|REDIS_URL)/.test(error.message)
      ? error.message
      : 'Startup failed. Check production assets, storage permissions and service configuration.';
  console.error(message);
  process.exit(1);
}
