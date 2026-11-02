import { eq, and, or, lt, isNull } from 'drizzle-orm';
import { db } from '@nesomn/api/src/db/client.ts';
import { withUserTransaction } from '@nesomn/api/src/db/transaction.ts';
import { aiJobs, aiProviders } from '@nesomn/api/src/db/schema/index.ts';
import { resolveProvider, ProviderFailure } from '@nesomn/api/src/modules/ai/provider.ts';
import { refundCreditTx } from '@nesomn/api/src/modules/ai/credit.ts';
import type { AiJobInput } from '@nesomn/shared';

export type ProcessResult = {
  status: 'done' | 'failed' | 'processing';
  resultUrl?: string;
  error?: string;
};
export async function processJob(
  jobId: string,
  resolver = resolveProvider,
): Promise<ProcessResult> {
  const original = await db.query.aiJobs.findFirst({ where: eq(aiJobs.id, jobId) });
  if (!original) return { status: 'failed', error: 'Job not found.' };
  const claim = await withUserTransaction(original.userId, async (tx) => {
    const job = await tx.query.aiJobs.findFirst({ where: eq(aiJobs.id, jobId) });
    if (!job || job.status !== 'pending') return { job, token: null };
    // A legacy pending reservation cannot be proven/refunded automatically.
    const outbox = await tx.query.aiOutbox.findFirst({ where: (t, { eq }) => eq(t.jobId, jobId) });
    if (!outbox) {
      await tx
        .update(aiJobs)
        .set({
          status: 'failed',
          needsReview: true,
          error: 'The legacy reservation requires reconciliation.',
          updatedAt: new Date(),
        })
        .where(eq(aiJobs.id, jobId));
      return { job: { ...job, status: 'failed' as const }, token: null };
    }
    const token = crypto.randomUUID();
    await tx
      .update(aiJobs)
      .set({
        status: 'processing',
        leaseToken: token,
        leaseUntil: new Date(Date.now() + 5 * 60000),
        updatedAt: new Date(),
      })
      .where(eq(aiJobs.id, jobId));
    return { job, token };
  });
  if (!claim.token)
    return {
      status: claim.job?.status === 'pending' ? 'processing' : (claim.job?.status ?? 'failed'),
      resultUrl: claim.job?.resultUrl ?? undefined,
      error: claim.job?.error ?? undefined,
    };
  let resultUrl: string | undefined, error: string | undefined, remoteRef: string | undefined;
  let needsReview = false;
  try {
    const provider = await db.query.aiProviders.findFirst({
      where: eq(aiProviders.id, claim.job!.providerId),
    });
    if (!provider?.enabled) throw new ProviderFailure(true);
    let adapter;
    try {
      adapter = await resolver(provider);
    } catch {
      throw new ProviderFailure(true);
    }
    ({ resultUrl } = await adapter.generate(claim.job!.input as AiJobInput, {
      onAccepted: async (ref) => {
        if (typeof ref !== 'string' || !/^[a-zA-Z0-9_-]{1,200}$/.test(ref))
          throw new Error('Invalid remote reference');
        remoteRef = ref;
        await withUserTransaction(original.userId, async (tx) => {
          const [updated] = await tx
            .update(aiJobs)
            .set({ providerRef: ref })
            .where(
              and(
                eq(aiJobs.id, jobId),
                eq(aiJobs.status, 'processing'),
                eq(aiJobs.leaseToken, claim.token!),
              ),
            )
            .returning();
          if (!updated) throw new Error('Job lease no longer owned');
        });
      },
    }));
  } catch (failure) {
    needsReview = !(failure instanceof ProviderFailure && failure.confirmed);
    if (failure instanceof ProviderFailure) remoteRef = failure.remoteRef ?? remoteRef;
    error = needsReview
      ? 'The provider result is unconfirmed. Reconciliation is required before retrying. Credits were refunded with their original expiry.'
      : 'The provider confirmed failure. Credits were refunded with their original expiry.';
  }
  return withUserTransaction(original.userId, async (tx) => {
    const current = await tx.query.aiJobs.findFirst({ where: eq(aiJobs.id, jobId) });
    if (!current || current.status !== 'processing' || current.leaseToken !== claim.token)
      return {
        status: current?.status === 'done' ? 'done' : 'failed',
        resultUrl: current?.resultUrl ?? undefined,
        error: current?.error ?? undefined,
      };
    if (error && current.creditCost > 0)
      await refundCreditTx(tx, current.userId, current.creditCost, current.id);
    await tx
      .update(aiJobs)
      .set({
        status: error ? 'failed' : 'done',
        needsReview,
        providerRef: remoteRef ?? current.providerRef,
        error: error ?? null,
        resultUrl: resultUrl ?? null,
        leaseToken: null,
        leaseUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(aiJobs.id, jobId));
    return { status: error ? 'failed' : 'done', resultUrl, error };
  });
}
/** Ambiguous processing is never re-submitted to a non-idempotent remote provider. */
export async function recoverJobs(now = new Date()) {
  const rows = await db
    .select()
    .from(aiJobs)
    .where(
      or(
        and(
          eq(aiJobs.status, 'processing'),
          or(lt(aiJobs.leaseUntil, now), isNull(aiJobs.leaseUntil)),
        ),
        and(
          eq(aiJobs.status, 'pending'),
          lt(aiJobs.createdAt, new Date(now.getTime() - 30 * 60000)),
        ),
      ),
    )
    .limit(100);
  for (const row of rows)
    await withUserTransaction(row.userId, async (tx) => {
      const job = await tx.query.aiJobs.findFirst({ where: eq(aiJobs.id, row.id) });
      if (!job || !['pending', 'processing'].includes(job.status)) return;
      if (job.status === 'processing' && job.leaseUntil && job.leaseUntil > now) return;
      if (job.status === 'pending' && job.createdAt.getTime() > now.getTime() - 30 * 60000) return;
      const reservation = await tx.query.aiOutbox.findFirst({
        where: (t, { eq }) => eq(t.jobId, job.id),
      });
      if (reservation && job.creditCost > 0)
        await refundCreditTx(tx, job.userId, job.creditCost, job.id, now);
      await tx
        .update(aiJobs)
        .set({
          status: 'failed',
          needsReview: job.status === 'processing' || !reservation,
          error: 'Timed out. Check the provider or legacy records before retrying manually.',
          leaseToken: null,
          leaseUntil: null,
          updatedAt: now,
        })
        .where(eq(aiJobs.id, job.id));
    });
  return rows.length;
}
