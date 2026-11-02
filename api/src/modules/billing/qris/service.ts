import { qrisConfig } from './config.ts';
export { qrisConfig } from './config.ts';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../../db/client.ts';
import { lockUser } from '../../../db/transaction.ts';
import {
  qrisInvoices,
  qrisReceipts,
  qrisReservations,
  orders,
  orderItems,
  paymentReceipts,
} from '../../../db/schema/index.ts';
import { buildOrder, checkoutBody } from '../quote.ts';
import { fulfillOrderTx, FulfillmentReviewError, validateSubscriptionPurchase } from '../grant.ts';
import { AppError } from '../../../middleware/error.ts';
import { chooseAmount, encodeQr } from './pure.ts';
const digest = (v: string) => createHash('sha256').update(v).digest('hex');
export async function createInvoice(
  userId: string,
  input: z.infer<typeof checkoutBody>,
  key: string,
  now = new Date(),
) {
  const config = qrisConfig();
  if (!/^[A-Za-z0-9_.-]{1,128}$/.test(key))
    throw new AppError('BAD_REQUEST', 'Idempotency-Key wajib.', 400);
  const requestHash = digest(JSON.stringify(input));
  const prior = await db.query.qrisInvoices.findFirst({
    where: and(eq(qrisInvoices.userId, userId), eq(qrisInvoices.requestKey, key)),
  });
  if (prior) {
    if (prior.requestHash !== requestHash)
      throw new AppError('CONFLICT', 'Idempotency-Key berbeda payload.', 409);
    const order = await db.query.orders.findFirst({ where: eq(orders.id, prior.orderId) });
    return { order: order!, checkoutUrl: '/checkout?order=' + prior.orderId };
  }
  const built = await buildOrder(input); // Read server quote before acquiring a pooled transaction; avoid pool starvation.
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${config.merchant + ':' + config.store},5))`,
    );
    await lockUser(tx, userId);
    const existing = await tx.query.qrisInvoices.findFirst({
      where: and(eq(qrisInvoices.userId, userId), eq(qrisInvoices.requestKey, key)),
    });
    if (existing) {
      if (existing.requestHash !== requestHash)
        throw new AppError('CONFLICT', 'Idempotency-Key berbeda payload.', 409);
      const order = await tx.query.orders.findFirst({ where: eq(orders.id, existing.orderId) });
      return { order: order!, checkoutUrl: '/checkout?order=' + existing.orderId };
    }
    if (input.type === 'subscription') {
      try {
        await validateSubscriptionPurchase(
          tx,
          userId,
          input.planId!,
          built.items[0]!.snapshot,
          now,
        );
      } catch (error) {
        if (error instanceof FulfillmentReviewError)
          throw new AppError(
            'SUBSCRIPTION_CONFLICT',
            'Plan/periode aktif memerlukan rekonsiliasi sebelum checkout.',
            409,
          );
        throw error;
      }
    }
    const used = await tx
      .select({ amount: qrisReservations.amountIdr })
      .from(qrisReservations)
      .where(
        and(
          eq(qrisReservations.merchantId, config.merchant),
          eq(qrisReservations.storeId, config.store),
          sql`${qrisReservations.amountIdr} BETWEEN ${built.amountIdr + 1} AND ${built.amountIdr + 999}`,
        ),
      );
    let reserved;
    try {
      reserved = chooseAmount(built.amountIdr, new Set(used.map((r) => r.amount)));
    } catch {
      throw new AppError(
        'QRIS_AMOUNT_UNAVAILABLE',
        'Nominal QRIS tidak tersedia; jangan membayar. Hubungi dukungan.',
        503,
      );
    }
    await tx
      .insert(qrisReservations)
      .values({ merchantId: config.merchant, storeId: config.store, amountIdr: reserved.payable });
    const [order] = await tx
      .insert(orders)
      .values({
        userId,
        type: input.type,
        amountIdr: String(built.amountIdr),
        amountUsd: String(built.amountUsd),
        currency: 'IDR',
        gateway: 'qris',
      })
      .returning();
    await tx.update(orders).set({ gatewayRef: order!.id }).where(eq(orders.id, order!.id));
    await tx.insert(orderItems).values(
      built.items.map((it) => ({
        orderId: order!.id,
        refType: it.refType,
        refId: it.refId,
        unitPriceIdr: it.unitIdr,
        unitPriceUsd: it.unitUsd,
        benefitSnapshot: it.snapshot,
      })),
    );
    await tx.insert(qrisInvoices).values({
      orderId: order!.id,
      userId,
      merchantId: config.merchant,
      storeId: config.store,
      requestKey: key,
      requestHash,
      baseIdr: built.amountIdr,
      code: reserved.code,
      payableIdr: reserved.payable,
      quote: {
        subtotalIdr: 'subtotalIdr' in built ? Number(built.subtotalIdr) : built.amountIdr,
        discountIdr: 'discountIdr' in built ? Number(built.discountIdr) : 0,
      },
      qrPayload: encodeQr(config.payload, reserved.payable),
      createdAt: now,
      expiresAt: new Date(now.getTime() + 15 * 60000),
    });
    return {
      order: { ...order!, gatewayRef: order!.id },
      checkoutUrl: '/checkout?order=' + order!.id,
    };
  });
}
export const receiptSchema = z
  .object({
    reference: z.string().regex(/^[A-Za-z0-9_.:-]{1,200}$/),
    merchantId: z.string().regex(/^\d{1,40}$/),
    storeId: z.string().regex(/^\d{1,40}$/),
    amountIdr: z.number().int().positive().max(999999999),
    createdAt: z.number().int().positive(),
    status: z.literal(3),
    completed: z.literal(true),
  })
  .strict();
export async function ingestReceipt(value: unknown, now = new Date()) {
  const config = qrisConfig(),
    receipt = receiptSchema.parse(value),
    paidAt = new Date(receipt.createdAt * 1000);
  if (
    receipt.merchantId !== config.merchant ||
    receipt.storeId !== config.store ||
    paidAt.getTime() > now.getTime() + 60000
  )
    throw new AppError('INVALID_RECEIPT', 'Receipt di luar scope/waktu.', 400);
  const fingerprint = digest(JSON.stringify(receipt));
  await db
    .insert(qrisReceipts)
    .values({
      merchantId: receipt.merchantId,
      storeId: receipt.storeId,
      reference: receipt.reference,
      amountIdr: receipt.amountIdr,
      paidAt,
      fingerprint,
    })
    .onConflictDoNothing();
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${config.merchant + ':' + config.store},5))`,
    );
    const where = and(
      eq(qrisReceipts.merchantId, receipt.merchantId),
      eq(qrisReceipts.storeId, receipt.storeId),
      eq(qrisReceipts.reference, receipt.reference),
    );
    const [saved] = await tx.select().from(qrisReceipts).where(where).for('update');
    if (!saved || saved.fingerprint !== fingerprint)
      throw new AppError(
        'RECEIPT_REPLAY_MISMATCH',
        'Receipt berubah; rekonsiliasi diperlukan.',
        409,
      );
    if (saved.outcome !== 'received') return { ok: true, outcome: saved.outcome, idempotent: true };
    const invoice = await tx.query.qrisInvoices.findFirst({
      where: and(
        eq(qrisInvoices.merchantId, receipt.merchantId),
        eq(qrisInvoices.storeId, receipt.storeId),
        eq(qrisInvoices.payableIdr, receipt.amountIdr),
      ),
    });
    let outcome = 'unmatched';
    if (invoice) {
      await lockUser(tx, invoice.userId);
      const [order] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, invoice.orderId))
        .for('update');
      if (
        !order ||
        order.gateway !== 'qris' ||
        order.gatewayRef !== invoice.orderId ||
        Number(order.amountIdr) !== invoice.baseIdr ||
        order.currency !== 'IDR'
      )
        throw new Error('Invoice/order mismatch');
      if (
        paidAt < invoice.createdAt ||
        paidAt > invoice.expiresAt ||
        order.status !== 'pending' ||
        invoice.status !== 'pending'
      )
        outcome = 'review_required';
      else {
        try {
          await tx.transaction(async (savepoint) => {
            await savepoint.insert(paymentReceipts).values({
              provider: 'qris',
              gatewayRef: receipt.merchantId + ':' + receipt.storeId + ':' + receipt.reference,
              orderId: order.id,
            });
            const [paid] = await savepoint
              .update(orders)
              .set({ status: 'paid', updatedAt: now })
              .where(eq(orders.id, order.id))
              .returning();
            await fulfillOrderTx(savepoint, paid!, now);
            await savepoint
              .update(qrisInvoices)
              .set({ status: 'paid' })
              .where(eq(qrisInvoices.orderId, order.id));
          });
          outcome = 'applied';
        } catch (error) {
          if (error instanceof FulfillmentReviewError || error instanceof z.ZodError)
            outcome = 'review_required';
          else throw error; // DB/network faults remain retryable; never ACK an uncommitted effect.
        }
      }
      if (outcome === 'review_required' && invoice.status !== 'paid')
        await tx
          .update(qrisInvoices)
          .set({ status: 'review_required' })
          .where(eq(qrisInvoices.orderId, invoice.orderId));
    }
    await tx.update(qrisReceipts).set({ outcome, orderId: invoice?.orderId }).where(where);
    return { ok: true, outcome, idempotent: false };
  });
}
export async function invoiceStatus(userId: string, orderId: string) {
  z.string().uuid().parse(orderId);
  const invoice = await db.query.qrisInvoices.findFirst({
    where: and(eq(qrisInvoices.orderId, orderId), eq(qrisInvoices.userId, userId)),
  });
  if (!invoice) throw new AppError('NOT_FOUND', 'Invoice tidak ditemukan.', 404);
  const order = await db.query.orders.findFirst({
    where: and(eq(orders.id, orderId), eq(orders.userId, userId)),
  });
  const { qrPayload, requestHash, requestKey, merchantId, storeId, ...safe } = invoice;
  void qrPayload;
  void requestHash;
  void requestKey;
  void merchantId;
  void storeId;
  return {
    ...safe,
    status:
      invoice.status === 'pending' && invoice.expiresAt <= new Date() ? 'expired' : invoice.status,
    order,
  };
}
