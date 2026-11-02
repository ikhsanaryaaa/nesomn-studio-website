import process from 'node:process';
import { createTestInvocation } from '../../scripts/test-baseline.mjs';

if (process.env.NESOMN_DISPOSABLE_TESTS !== '1')
  throw new Error('Fixture requires NESOMN_DISPOSABLE_TESTS=1');
// Fixed loopback disposable DB regardless of caller's DATABASE_URL or .env.
Object.assign(process.env, createTestInvocation('unit', process.env).env);
const { db, sql } = await import('../../api/src/db/client.ts');
const {
  users,
  sessions,
  aiProviders,
  aiJobs,
  creditLedger,
  orders,
  orderFulfillments,
  paymentEvents,
} = await import('../../api/src/db/schema/index.ts');
const { eq } = await import('../../api/node_modules/drizzle-orm');
const [action, id] = process.argv.slice(2);
try {
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Fixture ID invalid');
  const [identity] = await sql`SELECT current_database() AS db, current_user AS role`;
  if (identity?.db !== 'nesomn_revision_test' || identity.role !== 'nesomn_test')
    throw new Error('Not disposable DB');
  const user = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!user?.email.startsWith('revision-phase3-') || !user.email.endsWith('@deployment.invalid'))
    throw new Error('Not a synthetic deployment user');
  if (action === 'sample-png') {
    const { default: sharp } = await import('../../api/node_modules/sharp');
    const bytes = await sharp({
      create: { width: 2, height: 2, channels: 4, background: { r: 255, g: 100, b: 0, alpha: 1 } },
    })
      .png()
      .toBuffer();
    console.log(JSON.stringify({ bytes: bytes.toString('base64') }));
  } else if (action === 'session-ip') {
    const session = await db.query.sessions.findFirst({ where: eq(sessions.userId, id) });
    console.log(JSON.stringify({ ip: session?.ipAddress }));
  } else if (action === 'promote') {
    await db.update(users).set({ role: 'admin' }).where(eq(users.id, id));
    console.log('{}');
  } else if (action === 'prepare-ai') {
    const [provider] = await db
      .insert(aiProviders)
      .values({
        key: `sample-phase3-${id}`,
        modelName: 'Demo / Sample fixture only',
        kind: 'image',
        tab: 'scene',
        tierAccess: [],
        creditCost: 10,
      })
      .returning();
    const { adjustCredit } = await import('../../api/src/modules/ai/credit.ts');
    await adjustCredit(id, 100, 'deployment-fixture');
    console.log(JSON.stringify({ providerId: provider!.id }));
  } else if (action === 'prepare-payment') {
    const [order] = await db
      .insert(orders)
      .values({
        userId: id,
        type: 'topup',
        status: 'pending',
        amountIdr: '100',
        currency: 'IDR',
        gateway: 'stripe',
        gatewayRef: 'sample-receipt-' + id,
      })
      .returning();
    await db.insert(orderFulfillments).values({ orderId: order!.id, state: 'legacy_review' });
    console.log(JSON.stringify({ orderId: order!.id, gatewayRef: order!.gatewayRef }));
  } else if (action === 'payment-status') {
    const rows = await db.query.orders.findMany({ where: eq(orders.userId, id) });
    console.log(JSON.stringify({ statuses: rows.map((row) => row.status) }));
  } else if (action === 'job-state') {
    const job = await db.query.aiJobs.findFirst({
      where: eq(aiJobs.userId, id),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });
    const outbox = job
      ? await db.query.aiOutbox.findFirst({ where: (t, { eq }) => eq(t.jobId, job.id) })
      : null;
    console.log(
      JSON.stringify({
        status: job?.status,
        attempts: outbox?.attempts,
        error: outbox?.error,
        deliveredAt: outbox?.deliveredAt,
      }),
    );
  } else if (action === 'enqueue-sample') {
    const provider = await db.query.aiProviders.findFirst({
      where: eq(aiProviders.key, 'sample-phase3-' + id),
    });
    if (!provider) throw new Error('Missing sample provider');
    const { createAiJob } = await import('../../api/src/modules/ai/service.ts');
    const job = await createAiJob(id, provider.id, 'scene', {
      prompt: 'Demo / Sample drain',
      aspect: '1:1',
    });
    console.log(JSON.stringify({ id: job.id }));
  } else if (action === 'cleanup') {
    await db.delete(paymentEvents).where(eq(paymentEvents.eventId, 'sample-phase4-' + id));
    await db.delete(aiJobs).where(eq(aiJobs.userId, id));
    await db.delete(creditLedger).where(eq(creditLedger.userId, id));
    await db.delete(aiProviders).where(eq(aiProviders.key, `sample-phase3-${id}`));
    await db.delete(users).where(eq(users.id, id));
    console.log('{}');
  } else throw new Error('Unknown fixture action');
} finally {
  await sql.end({ timeout: 3 });
}
