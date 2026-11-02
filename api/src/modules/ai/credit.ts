import { and, eq, desc, sql } from 'drizzle-orm';
import { withUserTransaction, type Tx } from '../../db/transaction.ts';
import {
  creditAccounts,
  creditLots,
  creditAllocations,
  creditLedger,
} from '../../db/schema/index.ts';
import { AppError } from '../../middleware/error.ts';
import { effectiveSubscription } from '../../lib/entitlement.ts';
import { creditPeriod } from '../../lib/periods.ts';

function amountValid(amount: number) {
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 2_000_000_000)
    throw new Error('Invalid credit amount.');
}
function operation(userId: string, key: string) {
  if (!key || key.length > 256) throw new Error('An operation key is required.');
  return `${userId}:${key}`;
}
async function account(tx: Tx, userId: string) {
  let row = await tx.query.creditAccounts.findFirst({ where: eq(creditAccounts.userId, userId) });
  if (!row) {
    const entries = await tx
      .select()
      .from(creditLedger)
      .where(eq(creditLedger.userId, userId))
      .orderBy(desc(creditLedger.createdAt), desc(creditLedger.id));
    const sum = entries.reduce((total, item) => total + item.delta, 0);
    // Tied historical timestamps have no reliable order. A latest balance matching
    // the aggregate is sufficient for importing the aggregate, never rewriting history.
    const latest = entries[0];
    const candidates = latest
      ? entries.filter((item) => item.createdAt.getTime() === latest.createdAt.getTime())
      : [];
    if (
      sum < 0 ||
      !Number.isSafeInteger(sum) ||
      (latest && !candidates.some((item) => item.balanceAfter === sum))
    ) {
      throw new AppError(
        'CREDIT_RECONCILIATION',
        'Legacy balances require reconciliation before credit changes.',
        409,
      );
    }
    [row] = await tx.insert(creditAccounts).values({ userId, balance: sum }).returning();
    if (sum > 0)
      await tx.insert(creditLots).values({
        userId,
        sourceKey: operation(userId, 'legacy-import'),
        initial: sum,
        remaining: sum,
      });
  }
  return row!;
}
async function append(
  tx: Tx,
  userId: string,
  delta: number,
  reason: typeof creditLedger.$inferInsert.reason,
  key: string,
  refId?: string,
  refType?: string,
  now = new Date(),
) {
  const [row] = await tx
    .update(creditAccounts)
    .set({ balance: sql`${creditAccounts.balance} + ${delta}` })
    .where(eq(creditAccounts.userId, userId))
    .returning();
  if (!row || row.balance < 0)
    throw new AppError('INSUFFICIENT_CREDIT', 'Insufficient credits.', 402);
  await tx.insert(creditLedger).values({
    userId,
    delta,
    reason,
    operationKey: key,
    refId,
    refType,
    balanceAfter: row.balance,
    createdAt: now,
  });
  return row.balance;
}
async function previous(tx: Tx, userId: string, key: string, delta: number, reason: string) {
  const row = await tx.query.creditLedger.findFirst({ where: eq(creditLedger.operationKey, key) });
  if (row && (row.userId !== userId || row.delta !== delta || row.reason !== reason))
    throw new Error('The operation key was used with a different payload.');
  return row;
}
export async function grantCreditTx(
  tx: Tx,
  userId: string,
  amount: number,
  key: string,
  reason: 'topup' | 'subscription_grant' | 'admin_adjust',
  expiresAt?: Date,
  now = new Date(),
) {
  amountValid(amount);
  await account(tx, userId);
  const op = operation(userId, key);
  const old = await previous(tx, userId, op, amount, reason);
  if (old) {
    const lot = await tx.query.creditLots.findFirst({ where: eq(creditLots.sourceKey, op) });
    if ((lot?.expiresAt?.getTime() ?? null) !== (expiresAt?.getTime() ?? null))
      throw new Error('The operation expiry does not match.');
    return (await account(tx, userId)).balance;
  }
  if (expiresAt && (!Number.isFinite(expiresAt.getTime()) || expiresAt <= now))
    throw new Error('Invalid credit expiry.');
  await tx
    .insert(creditLots)
    .values({ userId, sourceKey: op, initial: amount, remaining: amount, expiresAt });
  return append(tx, userId, amount, reason, op, key, 'grant', now);
}
export async function balanceTx(tx: Tx, userId: string, now = new Date()): Promise<number> {
  await account(tx, userId);
  const lots = await tx
    .select()
    .from(creditLots)
    .where(
      and(
        eq(creditLots.userId, userId),
        sql`${creditLots.remaining} > 0 AND ${creditLots.expiresAt} <= ${now.toISOString()}`,
      ),
    );
  for (const lot of lots) {
    await tx.update(creditLots).set({ remaining: 0 }).where(eq(creditLots.id, lot.id));
    await append(
      tx,
      userId,
      -lot.remaining,
      'expiry',
      operation(userId, `expiry:${lot.id}`),
      lot.id,
      'credit_lot',
      now,
    );
  }
  const sub = await effectiveSubscription(userId, now, tx);
  if (sub?.benefits.creditQuota && sub.currentPeriodStart && sub.currentPeriodEnd) {
    const period = creditPeriod(sub.currentPeriodStart, now, sub.currentPeriodEnd);
    await grantCreditTx(
      tx,
      userId,
      sub.benefits.creditQuota,
      `quota:${sub.id}:${period.start.toISOString()}`,
      'subscription_grant',
      period.end,
      now,
    );
  }
  return (await account(tx, userId)).balance;
}
export async function deductCreditTx(
  tx: Tx,
  userId: string,
  amount: number,
  refId: string,
  now = new Date(),
  reason: 'usage' | 'admin_adjust' = 'usage',
) {
  amountValid(amount);
  const current = await balanceTx(tx, userId, now);
  const op = operation(userId, `${reason}:${refId}`);
  if (await previous(tx, userId, op, -amount, reason)) return current;
  if (current < amount) throw new AppError('INSUFFICIENT_CREDIT', 'Insufficient credits.', 402);
  const lots = await tx
    .select()
    .from(creditLots)
    .where(and(eq(creditLots.userId, userId), sql`${creditLots.remaining} > 0`))
    .orderBy(sql`${creditLots.expiresAt} ASC NULLS LAST`, creditLots.id);
  let remaining = amount;
  for (const lot of lots) {
    const take = Math.min(lot.remaining, remaining);
    if (!take) break;
    await tx
      .update(creditLots)
      .set({ remaining: lot.remaining - take })
      .where(eq(creditLots.id, lot.id));
    await tx.insert(creditAllocations).values({ operationKey: op, lotId: lot.id, amount: take });
    remaining -= take;
  }
  if (remaining) throw new Error('Credit lots require reconciliation.');
  return append(
    tx,
    userId,
    -amount,
    reason,
    op,
    refId,
    reason === 'usage' ? 'ai_job' : 'admin_adjust',
    now,
  );
}
export async function refundCreditTx(
  tx: Tx,
  userId: string,
  amount: number,
  refId: string,
  now = new Date(),
) {
  amountValid(amount);
  const current = await balanceTx(tx, userId, now);
  const chargeKey = operation(userId, `usage:${refId}`),
    refundKey = operation(userId, `refund:${refId}`);
  const charge = await tx.query.creditLedger.findFirst({
    where: eq(creditLedger.operationKey, chargeKey),
  });
  if (!charge || charge.delta !== -amount || charge.reason !== 'usage')
    throw new Error(
      'No matching charge was found for this refund. Legacy reconciliation is required.',
    );
  const old = await tx.query.creditLedger.findFirst({
    where: eq(creditLedger.operationKey, refundKey),
  });
  if (old) return current;
  const allocations = await tx
    .select({ allocation: creditAllocations, lot: creditLots })
    .from(creditAllocations)
    .innerJoin(creditLots, eq(creditLots.id, creditAllocations.lotId))
    .where(eq(creditAllocations.operationKey, chargeKey));
  if (allocations.reduce((sum, row) => sum + row.allocation.amount, 0) !== amount)
    throw new Error('Refund allocation does not match.');
  let restored = 0;
  for (const { allocation, lot } of allocations) {
    if (lot.expiresAt && lot.expiresAt <= now) continue;
    await tx
      .update(creditLots)
      .set({ remaining: lot.remaining + allocation.amount })
      .where(eq(creditLots.id, lot.id));
    restored += allocation.amount;
  }
  return append(tx, userId, restored, 'refund', refundKey, refId, 'ai_job', now);
}
export function getBalance(userId: string, now = new Date()) {
  return withUserTransaction(userId, (tx) => balanceTx(tx, userId, now));
}
export function deductCredit(userId: string, amount: number, refId: string, now = new Date()) {
  return withUserTransaction(userId, (tx) => deductCreditTx(tx, userId, amount, refId, now));
}
export function refundCredit(userId: string, amount: number, refId: string, now = new Date()) {
  return withUserTransaction(userId, (tx) => refundCreditTx(tx, userId, amount, refId, now));
}
export function adjustCredit(
  userId: string,
  delta: number,
  key: string,
  expiresAt?: Date,
  now = new Date(),
) {
  return withUserTransaction(userId, async (tx) => {
    await balanceTx(tx, userId, now);
    return delta > 0
      ? grantCreditTx(tx, userId, delta, `admin_adjust:${key}`, 'admin_adjust', expiresAt, now)
      : deductCreditTx(tx, userId, -delta, key, now, 'admin_adjust');
  });
}
