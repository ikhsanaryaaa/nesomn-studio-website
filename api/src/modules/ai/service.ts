import { validateAiMedia } from '../../lib/ai-media.ts';
import { createHash } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { withUserTransaction } from '../../db/transaction.ts';
import { aiJobs, aiProviders, aiOutbox, users } from '../../db/schema/index.ts';
import { deductCreditTx, refundCreditTx } from './credit.ts';
import { effectiveSubscription, subscriptionTier } from '../../lib/entitlement.ts';
import { resolveProvider } from './provider.ts';
import { AppError } from '../../middleware/error.ts';
import type { AiJobInput, AiTab } from '@nesomn/shared';

export async function createAiJob(
  userId: string,
  providerId: string,
  tab: AiTab,
  input: AiJobInput,
  requestKey?: string,
) {
  if (requestKey && !/^[a-zA-Z0-9_.-]{1,128}$/.test(requestKey))
    throw new AppError('BAD_REQUEST', 'Invalid Idempotency-Key.', 400);
  await validateAiMedia(input as unknown as Record<string, unknown>);
  const hash = createHash('sha256')
    .update(JSON.stringify({ providerId, tab, input }))
    .digest('hex');
  return withUserTransaction(userId, async (tx) => {
    const account = await tx.query.users.findFirst({ where: eq(users.id, userId) });
    if (account?.disabledAt) throw new AppError('FORBIDDEN', 'Account unavailable.', 403);
    if (requestKey) {
      const old = await tx.query.aiJobs.findFirst({
        where: and(eq(aiJobs.userId, userId), eq(aiJobs.requestKey, requestKey)),
      });
      if (old) {
        if (old.requestHash !== hash)
          throw new AppError('CONFLICT', 'Idempotency-Key was used with different input.', 409);
        return old;
      }
    }
    const provider = await tx.query.aiProviders.findFirst({
      where: eq(aiProviders.id, providerId),
    });
    if (!provider?.enabled || provider.tab !== tab)
      throw new AppError('NOT_FOUND', 'Model unavailable.', 404);
    // Resolve before reserving credit: incomplete configuration never becomes a paid demo.
    await resolveProvider(provider);
    const sub = await effectiveSubscription(userId, new Date(), tx);
    const tier = subscriptionTier(sub);
    if (provider.tierAccess.length && !provider.tierAccess.includes(tier))
      throw new AppError('FORBIDDEN', 'The model is not included in this plan.', 403);
    if (provider.kind === 'video' && !sub?.benefits.editorAccess.aiVideo)
      throw new AppError('FORBIDDEN', 'This plan does not include AI video.', 403);
    const active = await tx.query.aiJobs.findFirst({
      where: and(eq(aiJobs.userId, userId), inArray(aiJobs.status, ['pending', 'processing'])),
    });
    if (active) throw new AppError('JOB_IN_PROGRESS', 'A job is still running.', 409);
    if (!Number.isSafeInteger(provider.creditCost) || provider.creditCost < 0)
      throw new Error('Invalid provider cost');
    const id = crypto.randomUUID();
    if (provider.creditCost > 0) await deductCreditTx(tx, userId, provider.creditCost, id);
    const [job] = await tx
      .insert(aiJobs)
      .values({
        id,
        userId,
        providerId,
        kind: provider.kind,
        priority: tier === 'pro' ? 1 : 2,
        input,
        creditCost: provider.creditCost,
        requestKey,
        requestHash: hash,
      })
      .returning();
    await tx.insert(aiOutbox).values({ jobId: id });
    return job!;
  });
}
export function cancelAiJob(userId: string, jobId: string) {
  return withUserTransaction(userId, async (tx) => {
    const job = await tx.query.aiJobs.findFirst({
      where: and(eq(aiJobs.id, jobId), eq(aiJobs.userId, userId)),
    });
    if (!job) throw new AppError('NOT_FOUND', 'Job not found.', 404);
    if (job.status === 'failed') return job;
    if (job.status !== 'pending')
      throw new AppError('CONFLICT', 'Only pending jobs can be cancelled.', 409);
    if (job.creditCost > 0) await refundCreditTx(tx, userId, job.creditCost, job.id);
    const [updated] = await tx
      .update(aiJobs)
      .set({ status: 'failed', error: 'Cancelled before processing.', updatedAt: new Date() })
      .where(eq(aiJobs.id, job.id))
      .returning();
    return updated!;
  });
}
