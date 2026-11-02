import { createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client.ts';
import { withUserTransaction } from '../../db/transaction.ts';
import {
  orders,
  paymentEvents,
  orderFulfillments,
  paymentReceipts,
} from '../../db/schema/index.ts';
import { fulfillOrderTx } from './grant.ts';
import type { WebhookResult } from './gateway.ts';
import { assertStubAllowed } from '../../lib/demo-policy.ts';

export function amountMinor(amount: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(amount)) throw new Error('Invalid monetary amount');
  const [whole, fraction = ''] = amount.split('.');
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(result)) throw new Error('Amount too large');
  return result;
}
/** Only server-side verified adapters may call this service. Never expose directly. */
export async function settlePayment(provider: string, event: WebhookResult) {
  if (provider === 'stub') assertStubAllowed('payment');
  const fingerprint = createHash('sha256')
    .update(
      JSON.stringify({
        orderId: event.orderId,
        gatewayRef: event.gatewayRef,
        status: event.status,
        amountMinor: event.amountMinor,
        currency: event.currency,
      }),
    )
    .digest('hex');
  // Durable receipt first: a failed fulfillment remains replayable, never a false ACK.
  await db
    .insert(paymentEvents)
    .values({ provider, eventId: event.eventId, receipt: event, fingerprint })
    .onConflictDoNothing();
  const saved = await db.query.paymentEvents.findFirst({
    where: and(eq(paymentEvents.provider, provider), eq(paymentEvents.eventId, event.eventId)),
  });
  if (saved?.fingerprint !== fingerprint) throw new Error('Payment event replay payload mismatch');
  const order = await db.query.orders.findFirst({ where: eq(orders.id, event.orderId) });
  if (!order) throw new Error('Order tidak ditemukan.');
  return withUserTransaction(order.userId, async (tx) => {
    const [current] = await tx.select().from(orders).where(eq(orders.id, order.id)).for('update');
    const [receipt] = await tx
      .select()
      .from(paymentEvents)
      .where(and(eq(paymentEvents.provider, provider), eq(paymentEvents.eventId, event.eventId)))
      .for('update');
    if (!current || !receipt) throw new Error('Payment state unavailable');
    const marker = await tx.query.orderFulfillments.findFirst({
      where: eq(orderFulfillments.orderId, current.id),
    });
    if (marker?.state === 'legacy_review') {
      await tx
        .update(paymentEvents)
        .set({ outcome: 'review_required' })
        .where(and(eq(paymentEvents.provider, provider), eq(paymentEvents.eventId, event.eventId)));
      return { ok: true, outcome: 'review_required', idempotent: false };
    }
    if (
      current.gateway !== provider ||
      current.gatewayRef !== event.gatewayRef ||
      current.currency !== event.currency ||
      amountMinor(current.currency === 'USD' ? current.amountUsd : current.amountIdr) !==
        event.amountMinor
    )
      throw new Error('Payment does not match order');
    await tx
      .insert(paymentReceipts)
      .values({ provider, gatewayRef: event.gatewayRef, orderId: current.id })
      .onConflictDoNothing();
    const claim = await tx.query.paymentReceipts.findFirst({
      where: and(
        eq(paymentReceipts.provider, provider),
        eq(paymentReceipts.gatewayRef, event.gatewayRef),
      ),
    });
    if (claim?.orderId !== current.id) throw new Error('Receipt already belongs to another order.');
    if (receipt.outcome === 'applied' || marker?.state === 'fulfilled') {
      await tx
        .update(paymentEvents)
        .set({ outcome: 'applied' })
        .where(and(eq(paymentEvents.provider, provider), eq(paymentEvents.eventId, event.eventId)));
      return { ok: true, outcome: 'applied', idempotent: true };
    }
    if (current.status !== 'pending' || event.status !== 'paid')
      throw new Error('Order state requires reconciliation');
    const [paid] = await tx
      .update(orders)
      .set({ status: 'paid', updatedAt: new Date() })
      .where(eq(orders.id, current.id))
      .returning();
    await fulfillOrderTx(tx, paid!);
    await tx
      .update(paymentEvents)
      .set({ outcome: 'applied' })
      .where(and(eq(paymentEvents.provider, provider), eq(paymentEvents.eventId, event.eventId)));
    return { ok: true, outcome: 'applied', idempotent: false };
  });
}
