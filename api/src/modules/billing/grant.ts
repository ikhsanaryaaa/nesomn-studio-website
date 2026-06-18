import { eq, and, desc } from 'drizzle-orm';
import { db } from '../../db/client.ts';
import {
  orders,
  orderItems,
  subscriptions,
  plans,
  creditPacks,
  creditLedger,
  licenses,
  assets,
} from '../../db/schema/index.ts';

/**
 * Grant hak setelah order berstatus `paid`. Idempoten: bila order sudah
 * `paid` dan grant sudah dilakukan, panggilan ulang tidak menggandakan.
 * Semua perhitungan & grant di server (AI-RULES §4).
 *
 * - subscription: buat/perpanjang langganan + ledger `subscription_grant`.
 * - topup: tambah credit via ledger `topup`.
 * - asset/bundle: terbitkan license per aset.
 */

/** Tipe transaksi Drizzle (parameter callback db.transaction). */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Saldo credit terkini user (balanceAfter entri terbaru). */
async function latestBalance(tx: Tx, userId: string): Promise<number> {
  const [last] = await tx
    .select({ balance: creditLedger.balanceAfter })
    .from(creditLedger)
    .where(eq(creditLedger.userId, userId))
    .orderBy(desc(creditLedger.createdAt))
    .limit(1);
  return last?.balance ?? 0;
}

export async function grantOrder(orderId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const order = await tx.query.orders.findFirst({ where: eq(orders.id, orderId) });
    if (!order) throw new Error('Order tidak ditemukan.');
    if (order.status !== 'paid') {
      throw new Error('Order belum paid, grant ditolak.');
    }

    // Idempotensi: tandai grant via ledger/license/subscription yang refId-nya order.
    if (order.type === 'subscription') {
      await grantSubscription(tx, order);
    } else if (order.type === 'topup') {
      await grantTopup(tx, order);
    } else {
      await grantLicenses(tx, order);
    }
  });
}

/** Buat/perpanjang langganan + grant credit quota bulanan. */
async function grantSubscription(tx: Tx, order: typeof orders.$inferSelect) {
  // Cari planId dari order item.
  const [item] = await tx
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id))
    .limit(1);
  if (!item || item.refType !== 'plan') throw new Error('Order subscription tanpa plan.');

  const plan = await tx.query.plans.findFirst({ where: eq(plans.id, item.refId) });
  if (!plan) throw new Error('Plan tidak ditemukan.');

  // Idempotensi: langganan aktif dari gatewayRef ini sudah ada?
  const existing = await tx.query.subscriptions.findFirst({
    where: and(eq(subscriptions.userId, order.userId), eq(subscriptions.gateway, order.gateway ?? 'stub')),
    orderBy: [desc(subscriptions.createdAt)],
  });

  const now = new Date();
  const days = plan.cycle === 'yearly' ? 365 : 30;
  const periodEnd = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  // Perpanjang bila ada langganan aktif untuk plan sama; selain itu buat baru.
  if (existing && existing.planId === plan.id && existing.status === 'active') {
    const base = existing.currentPeriodEnd && existing.currentPeriodEnd > now ? existing.currentPeriodEnd : now;
    const extended = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
    await tx
      .update(subscriptions)
      .set({ currentPeriodEnd: extended, status: 'active', updatedAt: now })
      .where(eq(subscriptions.id, existing.id));
  } else {
    await tx.insert(subscriptions).values({
      userId: order.userId,
      planId: plan.id,
      status: 'active',
      cycle: plan.cycle,
      segment: plan.segment,
      gateway: order.gateway ?? 'stub',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    });
  }

  // Grant credit quota bulanan (bila ada).
  if (plan.creditQuota > 0) {
    const current = await latestBalance(tx, order.userId);
    await tx.insert(creditLedger).values({
      userId: order.userId,
      delta: plan.creditQuota,
      reason: 'subscription_grant',
      refType: 'order',
      refId: order.id,
      balanceAfter: current + plan.creditQuota,
    });
  }
}

/** Tambah credit dari pack top-up. Idempoten via refId = order.id. */
async function grantTopup(tx: Tx, order: typeof orders.$inferSelect) {
  // Cegah grant ganda untuk order yang sama.
  const dup = await tx.query.creditLedger.findFirst({
    where: and(
      eq(creditLedger.userId, order.userId),
      eq(creditLedger.refType, 'order'),
      eq(creditLedger.refId, order.id),
    ),
  });
  if (dup) return;

  const [item] = await tx
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id))
    .limit(1);
  if (!item || item.refType !== 'credit_pack') throw new Error('Order topup tanpa pack.');

  const pack = await tx.query.creditPacks.findFirst({ where: eq(creditPacks.id, item.refId) });
  if (!pack) throw new Error('Credit pack tidak ditemukan.');

  const current = await latestBalance(tx, order.userId);
  await tx.insert(creditLedger).values({
    userId: order.userId,
    delta: pack.credits,
    reason: 'topup',
    refType: 'order',
    refId: order.id,
    balanceAfter: current + pack.credits,
  });
}

/** Terbitkan license untuk tiap aset di order (idempoten per aset). */
async function grantLicenses(tx: Tx, order: typeof orders.$inferSelect) {
  const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  for (const item of items) {
    if (item.refType !== 'asset') continue;
    const existing = await tx.query.licenses.findFirst({
      where: and(eq(licenses.userId, order.userId), eq(licenses.assetId, item.refId)),
    });
    if (existing) continue;
    const asset = await tx.query.assets.findFirst({ where: eq(assets.id, item.refId) });
    await tx.insert(licenses).values({
      userId: order.userId,
      assetId: item.refId,
      orderId: order.id,
      fileKey: asset?.fileKey,
    });
  }
}
