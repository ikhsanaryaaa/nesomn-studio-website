import { and, eq, asc, gt } from 'drizzle-orm';
import { AppError } from '../../middleware/error.ts';
import { sessions, users } from '../../db/schema/index.ts';
import { withUserTransaction, type Tx } from '../../db/transaction.ts';
import { effectiveSubscription } from '../../lib/entitlement.ts';

export async function getMaxConcurrentSessions(userId: string): Promise<number | null> {
  const sub = await effectiveSubscription(userId);
  return sub ? sub.benefits.maxConcurrentSessions : 1;
}
async function enforce(tx: Tx, userId: string, reserve: number) {
  const sub = await effectiveSubscription(userId, new Date(), tx);
  const max = sub ? sub.benefits.maxConcurrentSessions : 1;
  if (max === null) return;
  const active = await tx
    .select()
    .from(sessions)
    .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, new Date())))
    .orderBy(asc(sessions.createdAt), asc(sessions.id));
  for (const row of active.slice(0, Math.max(0, active.length - Math.max(0, max - reserve))))
    await tx.delete(sessions).where(eq(sessions.id, row.id));
}
/** Compatibility helper; session creation itself performs enforcement atomically. */
export function enforceSessionLimit(userId: string) {
  return withUserTransaction(userId, (tx) => enforce(tx, userId, 1));
}
export function createSession(
  userId: string,
  userAgent: string | null,
  ipAddress: string | null,
): Promise<string> {
  return withUserTransaction(userId, async (tx) => {
    const account = await tx.query.users.findFirst({ where: eq(users.id, userId) });
    if (account?.disabledAt) throw new AppError('FORBIDDEN', 'Akun tidak tersedia.', 403);
    await enforce(tx, userId, 1);
    const [session] = await tx
      .insert(sessions)
      .values({
        userId,
        userAgent: userAgent?.slice(0, 512),
        ipAddress,
        expiresAt: new Date(Date.now() + 7 * 86400_000),
      })
      .returning();
    return session!.id;
  });
}
