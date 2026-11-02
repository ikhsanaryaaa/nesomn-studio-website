import { describe, expect, it, afterAll, beforeAll } from 'bun:test';
import { eq } from 'drizzle-orm';
import { db } from '@nesomn/api/src/db/client.ts';
import { users, aiProviders, aiJobs, creditLedger } from '@nesomn/api/src/db/schema/index.ts';
import { createAiJob } from '@nesomn/api/src/modules/ai/service.ts';
import { adjustCredit, getBalance } from '@nesomn/api/src/modules/ai/credit.ts';
import { processJob } from './process-job.ts';

/**
 * Unit test process-job dengan StubProvider: sukses (done) dan gagal
 * (failed + refund). Butuh Postgres (docker compose up db + migrate).
 */
describe('worker process-job (stub)', () => {
  const email = `worker-${crypto.randomUUID()}@test.local`;
  let userId = '';
  let providerId = '';

  beforeAll(async () => {
    const [u] = await db
      .insert(users)
      .values({ email, passwordHash: 'x', name: 'Worker Test', role: 'user' })
      .returning();
    userId = u.id;
    const [p] = await db
      .insert(aiProviders)
      .values({
        key: `stub-w-${crypto.randomUUID()}`,
        kind: 'image',
        modelName: 'stub-image',
        tab: 'scene',
        enabled: true,
        creditCost: 10,
        tierAccess: [],
      })
      .returning();
    providerId = p.id;
    await adjustCredit(userId, 100, 'fixture');
  });

  afterAll(async () => {
    await db.delete(aiJobs).where(eq(aiJobs.userId, userId));
    await db.delete(creditLedger).where(eq(creditLedger.userId, userId));
    await db.delete(aiProviders).where(eq(aiProviders.id, providerId));
    await db.delete(users).where(eq(users.id, userId));
  });

  it('memproses job sukses -> done dengan resultUrl', async () => {
    const job = await createAiJob(userId, providerId, 'scene', {
      prompt: 'Demo / Sample',
      aspect: '1:1',
    });

    const result = await processJob(job.id);
    expect(result.status).toBe('done');
    expect(result.resultUrl).toBeTruthy();

    const after = await db.query.aiJobs.findFirst({ where: eq(aiJobs.id, job.id) });
    expect(after?.status).toBe('done');
  });

  it('job gagal -> failed + refund credit', async () => {
    const job = await createAiJob(userId, providerId, 'scene', {
      prompt: 'Demo / Sample __fail__',
      aspect: '1:1',
    });
    const balanceBefore = await getBalance(userId);

    const result = await processJob(job.id);
    expect(result.status).toBe('failed');

    const after = await db.query.aiJobs.findFirst({ where: eq(aiJobs.id, job.id) });
    expect(after?.status).toBe('failed');

    // Credit dikembalikan (idempoten via refId = job.id).
    const balanceAfter = await getBalance(userId);
    expect(balanceAfter).toBe(balanceBefore + 10);
  });
});
