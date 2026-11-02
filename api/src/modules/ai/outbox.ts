import { and, eq, or, isNull, lt, sql } from 'drizzle-orm';
import { db } from '../../db/client.ts';
import { aiOutbox, aiJobs } from '../../db/schema/index.ts';
import { enqueueAiJob } from './queue.ts';
/** Durable SQL source; Redis delivery may repeat, the worker's SQL claim decides. */
export async function dispatchOutbox(send = enqueueAiJob) {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({ outbox: aiOutbox, job: aiJobs })
      .from(aiOutbox)
      .innerJoin(aiJobs, eq(aiJobs.id, aiOutbox.jobId))
      .where(
        and(
          eq(aiJobs.status, 'pending'),
          or(isNull(aiOutbox.deliveredAt), lt(aiOutbox.deliveredAt, new Date(Date.now() - 30000))),
        ),
      )
      .limit(20)
      .for('update', { of: aiOutbox, skipLocked: true });
    for (const { outbox, job } of rows) {
      try {
        await send(job.id, job.priority);
        await tx
          .update(aiOutbox)
          .set({ deliveredAt: new Date(), attempts: sql`${aiOutbox.attempts}+1`, error: null })
          .where(eq(aiOutbox.jobId, outbox.jobId));
      } catch {
        await tx
          .update(aiOutbox)
          .set({
            attempts: sql`${aiOutbox.attempts}+1`,
            error: 'Queue delivery unavailable; retry pending.',
          })
          .where(eq(aiOutbox.jobId, outbox.jobId));
        break;
      }
    }
    return rows.length;
  });
}
