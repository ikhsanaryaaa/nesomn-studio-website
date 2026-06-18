import { Elysia } from 'elysia';
import { z } from 'zod';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { db } from '../../db/client.ts';
import {
  plans,
  creditPacks,
  orders,
  orderItems,
  subscriptions,
  assets,
} from '../../db/schema/index.ts';
import { AppError } from '../../middleware/error.ts';
import { authPlugin, type AuthUser } from '../../middleware/auth.ts';
import { resolveGateway } from './gateway.ts';
import { grantOrder } from './grant.ts';
import { computeBundlePrice } from '../catalog/pricing.ts';
import type { Gateway } from '@nesomn/shared';

/**
 * Billing API: plan & pack (publik), checkout + webhook + grant (server-side),
 * riwayat, langganan, cancel. Harga dihitung ulang server-side; webhook
 * diverifikasi sebelum mengubah status; grant idempoten.
 */

const checkoutBody = z.object({
  type: z.enum(['asset', 'bundle', 'topup', 'subscription']),
  gateway: z.enum(['pakasir', 'stripe', 'stub']).default('stub'),
  planId: z.string().uuid().optional(),
  creditPackId: z.string().uuid().optional(),
  assetIds: z.array(z.string().uuid()).optional(),
});

/** Susun order + item berdasarkan tipe; harga dari DB (server-side). */
async function buildOrder(input: z.infer<typeof checkoutBody>) {
  if (input.type === 'subscription') {
    if (!input.planId) throw new AppError('BAD_REQUEST', 'planId wajib untuk subscription.', 400);
    const plan = await db.query.plans.findFirst({ where: eq(plans.id, input.planId) });
    if (!plan) throw new AppError('NOT_FOUND', 'Plan tidak ditemukan.', 404);
    if (plan.isEnterprise) throw new AppError('BAD_REQUEST', 'Enterprise via Contact Sales.', 400);
    return {
      amountIdr: Number(plan.priceIdr),
      amountUsd: Number(plan.priceUsd),
      description: `Langganan ${plan.name}`,
      items: [{ refType: 'plan', refId: plan.id, unitIdr: plan.priceIdr, unitUsd: plan.priceUsd }],
    };
  }
  if (input.type === 'topup') {
    if (!input.creditPackId) throw new AppError('BAD_REQUEST', 'creditPackId wajib.', 400);
    const pack = await db.query.creditPacks.findFirst({ where: eq(creditPacks.id, input.creditPackId) });
    if (!pack || !pack.enabled) throw new AppError('NOT_FOUND', 'Credit pack tidak tersedia.', 404);
    return {
      amountIdr: Number(pack.priceIdr),
      amountUsd: Number(pack.priceUsd),
      description: `Top-up ${pack.name} (${pack.credits} credit)`,
      items: [{ refType: 'credit_pack', refId: pack.id, unitIdr: pack.priceIdr, unitUsd: pack.priceUsd }],
    };
  }
  // asset / bundle
  if (!input.assetIds?.length) throw new AppError('BAD_REQUEST', 'assetIds wajib.', 400);
  const rows = await db.query.assets.findMany({ where: inArray(assets.id, input.assetIds) });
  if (rows.length !== input.assetIds.length) throw new AppError('NOT_FOUND', 'Sebagian aset tidak ada.', 404);
  const price = computeBundlePrice(
    rows.map((a) => ({ id: a.id, priceIdr: Number(a.priceIdr), priceUsd: Number(a.priceUsd) })),
  );
  return {
    amountIdr: price.totalIdr,
    amountUsd: price.totalUsd,
    description: input.type === 'bundle' ? `Bundle ${rows.length} aset` : rows[0].title,
    items: rows.map((a) => ({ refType: 'asset', refId: a.id, unitIdr: a.priceIdr, unitUsd: a.priceUsd })),
  };
}

export const billingRoutes = new Elysia({ prefix: '/billing' })
  .use(authPlugin)
  // Daftar plan (publik) untuk halaman pricing.
  .get('/plans', async () => {
    return db.query.plans.findMany({ orderBy: [plans.priceIdr] });
  })
  // Daftar credit pack aktif (publik).
  .get('/credit-packs', async () => {
    return db.query.creditPacks.findMany({ where: eq(creditPacks.enabled, true) });
  })
  // Buat order + checkout URL via gateway.
  .post(
    '/checkout',
    async ({ body, user }) => {
      const u = user as AuthUser;
      const input = checkoutBody.parse(body);
      const built = await buildOrder(input);

      const [order] = await db
        .insert(orders)
        .values({
          userId: u.id,
          type: input.type,
          status: 'pending',
          amountIdr: String(built.amountIdr),
          amountUsd: String(built.amountUsd),
          currency: 'IDR',
          gateway: input.gateway,
        })
        .returning();

      await db.insert(orderItems).values(
        built.items.map((it) => ({
          orderId: order.id,
          refType: it.refType,
          refId: it.refId,
          qty: 1,
          unitPriceIdr: String(it.unitIdr),
          unitPriceUsd: String(it.unitUsd),
        })),
      );

      const gateway = await resolveGateway(input.gateway as Gateway);
      const checkout = await gateway.createCheckout({
        id: order.id,
        amountIdr: built.amountIdr,
        amountUsd: built.amountUsd,
        currency: 'IDR',
        description: built.description,
      });

      await db
        .update(orders)
        .set({ gatewayRef: checkout.gatewayRef, updatedAt: new Date() })
        .where(eq(orders.id, order.id));

      return { order: { ...order, gatewayRef: checkout.gatewayRef }, checkoutUrl: checkout.checkoutUrl };
    },
    { requireAuth: true },
  )
  // Webhook: verifikasi signature -> set paid -> grant (idempoten). Publik.
  .post('/webhook/:gateway', async ({ params, request, set }) => {
    const gatewayName = params.gateway as Gateway;
    const rawBody = await request.text();
    const signature =
      request.headers.get('stripe-signature') ?? request.headers.get('x-pakasir-signature');

    const gateway = await resolveGateway(gatewayName);
    let result;
    try {
      result = await gateway.verifyWebhook(rawBody, signature);
    } catch {
      throw new AppError('INVALID_SIGNATURE', 'Webhook tidak terverifikasi.', 400);
    }

    const order = await db.query.orders.findFirst({ where: eq(orders.id, result.orderId) });
    if (!order) throw new AppError('NOT_FOUND', 'Order tidak ditemukan.', 404);

    // Idempotensi: bila sudah paid, jangan grant lagi.
    if (order.status === 'paid') {
      set.status = 200;
      return { ok: true, idempotent: true };
    }

    if (result.status === 'failed') {
      await db.update(orders).set({ status: 'failed', updatedAt: new Date() }).where(eq(orders.id, order.id));
      return { ok: true };
    }

    await db
      .update(orders)
      .set({ status: 'paid', gatewayRef: result.gatewayRef, updatedAt: new Date() })
      .where(eq(orders.id, order.id));
    await grantOrder(order.id);
    return { ok: true };
  })
  // Simulasi pembayaran (hanya dev/stub) untuk menguji alur penuh.
  .post(
    '/dev/pay/:orderId',
    async ({ params, user }) => {
      const u = user as AuthUser;
      const order = await db.query.orders.findFirst({
        where: and(eq(orders.id, params.orderId), eq(orders.userId, u.id)),
      });
      if (!order) throw new AppError('NOT_FOUND', 'Order tidak ditemukan.', 404);
      if (order.gateway !== 'stub') {
        throw new AppError('FORBIDDEN', 'Simulasi hanya untuk gateway stub.', 403);
      }
      if (order.status === 'paid') return { ok: true, idempotent: true };
      await db.update(orders).set({ status: 'paid', updatedAt: new Date() }).where(eq(orders.id, order.id));
      await grantOrder(order.id);
      return { ok: true };
    },
    { requireAuth: true },
  )
  // Riwayat order user.
  .get(
    '/history',
    async ({ user }) => {
      const u = user as AuthUser;
      return db.query.orders.findMany({
        where: eq(orders.userId, u.id),
        orderBy: [desc(orders.createdAt)],
        limit: 50,
      });
    },
    { requireAuth: true },
  )
  // Langganan aktif user.
  .get(
    '/subscription',
    async ({ user }) => {
      const u = user as AuthUser;
      const sub = await db.query.subscriptions.findFirst({
        where: and(eq(subscriptions.userId, u.id), eq(subscriptions.status, 'active')),
        orderBy: [desc(subscriptions.currentPeriodEnd)],
      });
      return sub ?? null;
    },
    { requireAuth: true },
  )
  // Batalkan langganan: status canceled, akses sampai periode habis.
  .post(
    '/subscription/cancel',
    async ({ user }) => {
      const u = user as AuthUser;
      const sub = await db.query.subscriptions.findFirst({
        where: and(eq(subscriptions.userId, u.id), eq(subscriptions.status, 'active')),
      });
      if (!sub) throw new AppError('NOT_FOUND', 'Tidak ada langganan aktif.', 404);
      const [updated] = await db
        .update(subscriptions)
        .set({ status: 'canceled', updatedAt: new Date() })
        .where(eq(subscriptions.id, sub.id))
        .returning();
      return updated;
    },
    { requireAuth: true },
  );
