import { eq, sql } from 'drizzle-orm';
import { db } from '../../db/client.ts';
import { subscriptions, projects } from '../../db/schema/index.ts';
import { withUserTransaction } from '../../db/transaction.ts';
export const RETENTION_DAYS = 30;
export function retentionCutoff(now = new Date()) {
  return new Date(now.getTime() - RETENTION_DAYS * 86400000);
}
/** Latest paid period, across every status, prevents an old row deleting renewed work. */
export async function selectExpiredUserIds(now = new Date()): Promise<string[]> {
  const rows = await db
    .select({ userId: subscriptions.userId })
    .from(subscriptions)
    .groupBy(subscriptions.userId)
    .having(
      sql`max(${subscriptions.currentPeriodEnd}) < ${retentionCutoff(now).toISOString()} AND count(*) FILTER (WHERE ${subscriptions.status} IN ('active','canceled') AND ${subscriptions.currentPeriodEnd} IS NULL) = 0`,
    );
  return rows.map((r) => r.userId);
}
/** Dry run by default. Destructive execution requires a separately approved explicit ID list. */
export async function runRetention(
  now = new Date(),
  options?: { execute: boolean; approvedUserIds: string[] },
): Promise<number> {
  const candidates = await selectExpiredUserIds(now);
  if (!options?.execute) return candidates.length;
  if (process.env.RETENTION_EXECUTION_APPROVED !== 'true')
    throw new Error('Retention execution requires explicit operator approval and backup.');
  const allowed = new Set(options.approvedUserIds);
  let count = 0;
  for (const id of candidates.filter((id) => allowed.has(id)))
    await withUserTransaction(id, async (tx) => {
      const rows = await tx
        .select({ end: subscriptions.currentPeriodEnd })
        .from(subscriptions)
        .where(eq(subscriptions.userId, id));
      if (!rows.length || rows.some((r) => !r.end || r.end >= retentionCutoff(now))) return;
      await tx.delete(projects).where(eq(projects.userId, id));
      count++;
    });
  return count;
}
