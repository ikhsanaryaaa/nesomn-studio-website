export class FulfillmentReviewError extends Error {}
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/client.ts';
import { withUserTransaction, type Tx } from '../../db/transaction.ts';
import {
  orders,
  orderItems,
  subscriptions,
  licenses,
  assets,
  orderFulfillments,
} from '../../db/schema/index.ts';
import { grantCreditTx, balanceTx } from '../ai/credit.ts';
import { effectiveSubscription } from '../../lib/entitlement.ts';
import { addCalendarMonths, creditPeriod, extendBillingPeriod } from '../../lib/periods.ts';

const benefitsSchema = z.object({
  creditQuota: z.number().int().nonnegative(),
  maxConcurrentSessions: z.number().int().positive().nullable(),
  code: z.string(),
  editorAccess: z.object({
    scene2d: z.boolean(),
    editor3d: z.boolean(),
    proTemplates: z.boolean(),
    aiVideo: z.boolean(),
  }),
  cycle: z.enum(['monthly', 'yearly']),
  segment: z.enum(['individual', 'team', 'enterprise']),
});
/** Caller holds the user's stable lock and settles payment in this same transaction. */
export async function fulfillOrderTx(tx: Tx, order: typeof orders.$inferSelect, now = new Date()) {
  const marker = await tx.query.orderFulfillments.findFirst({
    where: eq(orderFulfillments.orderId, order.id),
  });
  if (marker?.state === 'legacy_review')
    throw new FulfillmentReviewError('Order legacy memerlukan rekonsiliasi manual.');
  if (marker?.state === 'fulfilled') return;
  if (order.status !== 'paid') throw new FulfillmentReviewError('Order belum paid.');
  const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  if (!items.length) throw new FulfillmentReviewError('Order tanpa item.');
  if (order.type === 'subscription') {
    const item = items[0]!;
    if (items.length !== 1 || item.refType !== 'plan')
      throw new FulfillmentReviewError('Invalid subscription items');
    const benefits = benefitsSchema.parse(item.benefitSnapshot);
    const existing = await effectiveSubscription(order.userId, now, tx);
    if (existing && (existing.planId !== item.refId || existing.cycle !== benefits.cycle))
      throw new FulfillmentReviewError(
        'Pergantian plan/periode aktif memerlukan rekonsiliasi; proration tidak otomatis.',
      );
    if (existing) {
      if (
        !existing.managedBenefits ||
        existing.benefits.creditQuota !== benefits.creditQuota ||
        existing.benefits.maxConcurrentSessions !== benefits.maxConcurrentSessions ||
        Object.entries(benefits.editorAccess).some(
          ([key, value]) =>
            existing.benefits.editorAccess[key as keyof typeof benefits.editorAccess] !== value,
        )
      )
        throw new FulfillmentReviewError(
          'Perubahan benefit atau renewal legacy/manual memerlukan rekonsiliasi.',
        );
      await tx
        .update(subscriptions)
        .set({
          status: 'active',
          currentPeriodEnd: extendBillingPeriod(
            existing.currentPeriodStart!,
            existing.currentPeriodEnd!,
            benefits.cycle,
          ),
          updatedAt: now,
        })
        .where(eq(subscriptions.id, existing.id));
    } else {
      await tx.insert(subscriptions).values({
        userId: order.userId,
        planId: item.refId,
        status: 'active',
        cycle: benefits.cycle,
        segment: benefits.segment,
        gateway: order.gateway,
        currentPeriodStart: now,
        currentPeriodEnd: addCalendarMonths(now, benefits.cycle === 'yearly' ? 12 : 1),
        benefits,
      });
    }
    await balanceTx(tx, order.userId, now);
  } else if (order.type === 'topup') {
    const item = items[0]!;
    if (items.length !== 1 || item.refType !== 'credit_pack')
      throw new FulfillmentReviewError('Invalid topup items');
    const { credits } = z
      .object({ credits: z.number().int().positive() })
      .parse(item.benefitSnapshot);
    const sub = await effectiveSubscription(order.userId, now, tx);
    const expiry = sub
      ? creditPeriod(sub.currentPeriodStart!, now, sub.currentPeriodEnd!).end
      : addCalendarMonths(now, 1);
    await balanceTx(tx, order.userId, now);
    await grantCreditTx(tx, order.userId, credits, `order:${order.id}`, 'topup', expiry, now);
  } else {
    for (const item of items) {
      if (item.refType !== 'asset' || item.qty !== 1)
        throw new FulfillmentReviewError('Invalid asset item');
      const asset = await tx.query.assets.findFirst({ where: eq(assets.id, item.refId) });
      if (!asset) throw new FulfillmentReviewError('Aset tidak tersedia untuk fulfillment.');
      const snapshot = z.object({ fileKey: z.string().nullable() }).parse(item.benefitSnapshot);
      await tx
        .insert(licenses)
        .values({
          userId: order.userId,
          assetId: asset.id,
          orderId: order.id,
          fileKey: snapshot.fileKey,
        })
        .onConflictDoNothing();
    }
  }
  await tx.insert(orderFulfillments).values({ orderId: order.id, state: 'fulfilled' });
}
/** Legacy compatibility entry: never makes a pending order paid. */
export async function grantOrder(orderId: string): Promise<void> {
  const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!order) throw new FulfillmentReviewError('Order tidak ditemukan.');
  await withUserTransaction(order.userId, async (tx) => {
    const [current] = await tx
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.userId, order.userId)))
      .for('update');
    if (!current) throw new FulfillmentReviewError('Order tidak ditemukan.');
    await fulfillOrderTx(tx, current);
  });
}

export async function validateSubscriptionPurchase(
  tx: Tx,
  userId: string,
  planId: string,
  snapshot: unknown,
  now = new Date(),
) {
  const benefits = benefitsSchema.parse(snapshot),
    existing = await effectiveSubscription(userId, now, tx);
  if (
    existing &&
    (existing.planId !== planId ||
      existing.cycle !== benefits.cycle ||
      !existing.managedBenefits ||
      existing.benefits.creditQuota !== benefits.creditQuota ||
      existing.benefits.maxConcurrentSessions !== benefits.maxConcurrentSessions ||
      Object.entries(benefits.editorAccess).some(
        ([key, value]) =>
          existing.benefits.editorAccess[key as keyof typeof benefits.editorAccess] !== value,
      ))
  )
    throw new FulfillmentReviewError('Subscription memerlukan rekonsiliasi sebelum checkout.');
}
