import './disposable.ts';
import { test, expect, afterAll } from 'bun:test';
import { eq } from '../../api/node_modules/drizzle-orm';
import { db } from '../../api/src/db/client.ts';
import { users, aiProviders, aiJobs, aiOutbox } from '../../api/src/db/schema/index.ts';
import { adjustCredit, getBalance } from '../../api/src/modules/ai/credit.ts';
import { createAiJob, cancelAiJob } from '../../api/src/modules/ai/service.ts';
import { dispatchOutbox } from '../../api/src/modules/ai/outbox.ts';
import { processJob, recoverJobs } from '../../worker/src/process-job.ts';
if (process.env.NESOMN_DISPOSABLE_TESTS !== '1') throw new Error('Disposable only');
const ids: string[] = [],
  providers: string[] = [];
afterAll(async () => {
  for (const id of ids) await db.delete(users).where(eq(users.id, id));
  for (const id of providers) await db.delete(aiProviders).where(eq(aiProviders.id, id));
});
async function fixture() {
  const [user] = await db
    .insert(users)
    .values({ email: `sec-job-${crypto.randomUUID()}@test.invalid`, name: 'Demo / Sample' })
    .returning();
  ids.push(user!.id);
  const [provider] = await db
    .insert(aiProviders)
    .values({
      key: `stub-${crypto.randomUUID()}`,
      kind: 'image',
      tab: 'scene',
      modelName: 'Demo / Sample',
      creditCost: 3,
    })
    .returning();
  providers.push(provider!.id);
  await adjustCredit(user!.id, 20, 'fixture');
  return {
    user: user!,
    provider: provider!,
    input: { prompt: 'Demo / Sample', aspect: '1:1' as const },
  };
}
test('outage leaves durable pending job, duplicate request is one debit, terminal replay is harmless', async () => {
  const { user, provider, input } = await fixture();
  const results = await Promise.all(
    Array.from({ length: 8 }, () =>
      createAiJob(user.id, provider.id, 'scene', input, 'same-request'),
    ),
  );
  expect(new Set(results.map((x) => x.id)).size).toBe(1);
  expect(await getBalance(user.id)).toBe(17);
  await expect(
    createAiJob(user.id, provider.id, 'scene', input, 'different-request'),
  ).rejects.toThrow();
  const job = results[0]!;
  await dispatchOutbox(async () => {
    throw new Error('offline');
  });
  expect(
    (await db.query.aiOutbox.findFirst({ where: eq(aiOutbox.jobId, job.id) }))?.deliveredAt,
  ).toBeNull();
  expect((await processJob(job.id)).status).toBe('done');
  expect((await processJob(job.id)).status).toBe('done');
  expect(await getBalance(user.id)).toBe(17);
});
test('pending cancellation and stale processing refund exactly once without provider replay', async () => {
  const { user, provider, input } = await fixture();
  const canceled = await createAiJob(user.id, provider.id, 'scene', input, 'cancel');
  await Promise.all([cancelAiJob(user.id, canceled.id), cancelAiJob(user.id, canceled.id)]);
  expect(await getBalance(user.id)).toBe(20);
  const stale = await createAiJob(user.id, provider.id, 'scene', input, 'stale');
  await db
    .update(aiJobs)
    .set({
      status: 'processing',
      leaseToken: crypto.randomUUID(),
      leaseUntil: new Date(Date.now() - 1000),
    })
    .where(eq(aiJobs.id, stale.id));
  await recoverJobs();
  await recoverJobs();
  const row = await db.query.aiJobs.findFirst({ where: eq(aiJobs.id, stale.id) });
  expect(row?.status).toBe('failed');
  expect(row?.needsReview).toBe(true);
  expect((await processJob(stale.id)).status).toBe('failed');
  expect(await getBalance(user.id)).toBe(20);
});

test('accepted then unconfirmed provider result stays visible for reconciliation', async () => {
  const { user, provider, input } = await fixture();
  const job = await createAiJob(user.id, provider.id, 'scene', input, 'ambiguous');
  await processJob(job.id, async () => ({
    kind: 'image',
    tab: 'scene',
    async generate(_input, context) {
      await context?.onAccepted('sample-remote-id');
      throw new Error('Synthetic poll timeout after remote acceptance');
    },
  }));
  const row = await db.query.aiJobs.findFirst({ where: eq(aiJobs.id, job.id) });
  expect(row?.status).toBe('failed');
  expect(row?.needsReview).toBe(true);
  expect(row?.providerRef).toBe('sample-remote-id');
  expect(await getBalance(user.id)).toBe(20);
});

test('effective Free Basic never grants Pro AI models or queue priority', async () => {
  const { user, provider, input } = await fixture();
  const { plans, subscriptions } = await import('../../api/src/db/schema/index.ts');
  const [plan] = await db
    .insert(plans)
    .values({
      code: crypto.randomUUID(),
      name: 'Demo / Sample Free Basic',
      segment: 'individual',
      cycle: 'monthly',
      editorAccess: { scene2d: true, editor3d: false, proTemplates: false, aiVideo: false },
    })
    .returning();
  try {
    await db
      .insert(subscriptions)
      .values({
        userId: user.id,
        planId: plan!.id,
        status: 'active',
        cycle: 'monthly',
        segment: 'individual',
        currentPeriodStart: new Date(Date.now() - 1000),
        currentPeriodEnd: new Date(Date.now() + 86400000),
      });
    await db
      .update(aiProviders)
      .set({ tierAccess: ['pro'] })
      .where(eq(aiProviders.id, provider.id));
    await expect(
      createAiJob(user.id, provider.id, 'scene', input, 'free-denied'),
    ).rejects.toThrow();
    await db
      .update(aiProviders)
      .set({ tierAccess: ['free'] })
      .where(eq(aiProviders.id, provider.id));
    const job = await createAiJob(user.id, provider.id, 'scene', input, 'free-allowed');
    expect(job.priority).toBe(2);
    await cancelAiJob(user.id, job.id);
    expect(await getBalance(user.id)).toBe(20);
  } finally {
    await db.delete(subscriptions).where(eq(subscriptions.userId, user.id));
    await db.delete(plans).where(eq(plans.id, plan!.id));
  }
});

test('invalid remote reference fails safely with refundable/reviewable job', async () => {
  const { user, provider, input } = await fixture();
  const job = await createAiJob(user.id, provider.id, 'scene', input, 'invalid-remote-ref');
  await processJob(job.id, async () => ({
    kind: 'image',
    tab: 'scene',
    async generate(_input, context) {
      await context?.onAccepted(123 as unknown as string);
      throw new Error('invalid adapter');
    },
  }));
  const row = await db.query.aiJobs.findFirst({ where: eq(aiJobs.id, job.id) });
  expect(row?.status).toBe('failed');
  expect(row?.needsReview).toBe(true);
  expect(row?.providerRef).toBeNull();
  expect(await getBalance(user.id)).toBe(20);
});
