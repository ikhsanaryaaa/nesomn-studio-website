import './disposable.ts';
import { test, expect } from 'bun:test';
import { eq } from '../../api/node_modules/drizzle-orm';
import { Worker } from '../../api/node_modules/bullmq';
import { db } from '../../api/src/db/client.ts';
import { users, aiProviders, aiJobs } from '../../api/src/db/schema/index.ts';
import { adjustCredit, getBalance } from '../../api/src/modules/ai/credit.ts';
import { createAiJob } from '../../api/src/modules/ai/service.ts';
import { dispatchOutbox } from '../../api/src/modules/ai/outbox.ts';
import { redisConnection } from '../../api/src/lib/redis.ts';
import { processJob } from '../../worker/src/process-job.ts';
test('actual BullMQ dispatch/consumer succeeds, failed job refunds once and terminal redelivery is harmless', async () => {
  const worker = new Worker('ai-jobs', async (job) => processJob(job.data.jobId), {
    connection: redisConnection(process.env.REDIS_URL!, 'worker'),
    concurrency: 2,
  });
  const [user] = await db
    .insert(users)
    .values({ email: `sec-queue-${crypto.randomUUID()}@test.invalid`, name: 'Demo / Sample' })
    .returning();
  const [provider] = await db
    .insert(aiProviders)
    .values({
      key: `sample-${crypto.randomUUID()}`,
      modelName: 'Demo / Sample',
      kind: 'image',
      tab: 'scene',
      creditCost: 3,
    })
    .returning();
  try {
    await worker.waitUntilReady();
    await adjustCredit(user!.id, 10, 'fixture');
    for (const [prompt, status] of [
      ['Demo / Sample', 'done'],
      ['Demo / Sample __fail__', 'failed'],
    ] as const) {
      const job = await createAiJob(user!.id, provider!.id, 'scene', { prompt, aspect: '1:1' });
      await dispatchOutbox();
      let state;
      for (let i = 0; i < 50; i++) {
        state = await db.query.aiJobs.findFirst({ where: eq(aiJobs.id, job.id) });
        if (state?.status === status) break;
        await Bun.sleep(100);
      }
      expect(state?.status).toBe(status);
      expect((await processJob(job.id)).status).toBe(status);
    }
    expect(await getBalance(user!.id)).toBe(7);
  } finally {
    await worker.close();
    await db.delete(users).where(eq(users.id, user!.id));
    await db.delete(aiProviders).where(eq(aiProviders.id, provider!.id));
  }
}, 15000);

test('failed queue entry before SQL claim is retried after recovery', async () => {
  const { aiQueue } = await import('../../api/src/modules/ai/queue.ts');
  const { aiOutbox } = await import('../../api/src/db/schema/index.ts');
  let calls = 0;
  const worker = new Worker(
    'ai-jobs',
    async (job) => {
      if (++calls === 1) throw new Error('Synthetic transient DB outage before claim');
      return processJob(job.data.jobId);
    },
    { connection: redisConnection(process.env.REDIS_URL!, 'worker') },
  );
  const [u] = await db
    .insert(users)
    .values({ email: `sec-retry-${crypto.randomUUID()}@test.invalid`, name: 'Demo / Sample' })
    .returning();
  const [p] = await db
    .insert(aiProviders)
    .values({
      key: `sample-${crypto.randomUUID()}`,
      modelName: 'Demo / Sample',
      kind: 'image',
      tab: 'scene',
      creditCost: 3,
    })
    .returning();
  try {
    await worker.waitUntilReady();
    await adjustCredit(u!.id, 10, 'fixture');
    const job = await createAiJob(u!.id, p!.id, 'scene', {
      prompt: 'Demo / Sample',
      aspect: '1:1',
    });
    await dispatchOutbox();
    let state;
    for (let i = 0; i < 40; i++) {
      state = await (await aiQueue.getJob(job.id))?.getState();
      if (state === 'failed') break;
      await Bun.sleep(50);
    }
    expect(state).toBe('failed');
    expect((await db.query.aiJobs.findFirst({ where: eq(aiJobs.id, job.id) }))?.status).toBe(
      'pending',
    );
    await db
      .update(aiOutbox)
      .set({ deliveredAt: new Date(0) })
      .where(eq(aiOutbox.jobId, job.id));
    await dispatchOutbox();
    let current;
    for (let i = 0; i < 35; i++) {
      current = await db.query.aiJobs.findFirst({ where: eq(aiJobs.id, job.id) });
      if (current?.status === 'done') break;
      await Bun.sleep(50);
    }
    expect(current?.status).toBe('done');
    expect(await getBalance(u!.id)).toBe(7);
    expect(calls).toBe(2);
  } finally {
    await worker.close();
    await db.delete(users).where(eq(users.id, u!.id));
    await db.delete(aiProviders).where(eq(aiProviders.id, p!.id));
  }
}, 15000);
