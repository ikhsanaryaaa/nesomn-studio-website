import QRCode from 'qrcode';
import { createInvoice, ingestReceipt, invoiceStatus, qrisConfig } from './qris/service.ts';
import { verifyReceiptSignature, readReceiptBody } from './qris/pure.ts';
import { qrisInvoices } from '../../db/schema/index.ts';
import { checkoutBody, buildOrder } from './quote.ts';
import { Elysia } from 'elysia';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../../db/client.ts';
import { plans, creditPacks, orders, orderItems, subscriptions } from '../../db/schema/index.ts';
import { AppError } from '../../middleware/error.ts';
import { authPlugin, type AuthUser } from '../../middleware/auth.ts';
import { resolveGateway } from './gateway.ts';
import { settlePayment, amountMinor } from './settlement.ts';
import { assertStubAllowed } from '../../lib/demo-policy.ts';
import { withUserTransaction } from '../../db/transaction.ts';
import { effectiveSubscription } from '../../lib/entitlement.ts';
import type { Gateway } from '@nesomn/shared';

/**
 * Billing API: plan & pack (publik), checkout + webhook + grant (server-side),
 * riwayat, langganan, cancel. Harga dihitung ulang server-side; webhook
 * diverifikasi sebelum mengubah status; grant idempoten.
 */

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
    async ({ body, user, request }) => {
      const u = user as AuthUser;
      const input = checkoutBody.parse(body);
      if (input.gateway === 'qris')
        return createInvoice(u.id, input, request.headers.get('idempotency-key') ?? '');
      const gateway = await resolveGateway(input.gateway as Gateway);
      const built = await buildOrder(input);
      amountMinor(String(built.amountIdr));
      amountMinor(String(built.amountUsd));
      const result = await withUserTransaction(u.id, async (tx) => {
        const [order] = await tx
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
        await tx.insert(orderItems).values(
          built.items.map((it) => ({
            orderId: order!.id,
            refType: it.refType,
            refId: it.refId,
            qty: 1,
            unitPriceIdr: String(it.unitIdr),
            unitPriceUsd: String(it.unitUsd),
            benefitSnapshot: it.snapshot,
          })),
        );
        const checkout = await gateway.createCheckout({
          id: order!.id,
          amountIdr: built.amountIdr,
          amountUsd: built.amountUsd,
          currency: 'IDR',
          description: built.description,
        });
        await tx
          .update(orders)
          .set({ gatewayRef: checkout.gatewayRef })
          .where(eq(orders.id, order!.id));
        return { order: order!, checkout };
      });
      const { order, checkout } = result;

      return {
        order: { ...order, gatewayRef: checkout.gatewayRef },
        checkoutUrl: checkout.checkoutUrl,
      };
    },
    { requireAuth: true },
  )
  // Webhook: verifikasi signature -> set paid -> grant (idempoten). Publik.
  .post(
    '/webhook/:gateway',
    async ({ params, body, request, set }) => {
      const gateway = await resolveGateway(params.gateway as Gateway, 'webhook');
      let result;
      try {
        result = await gateway.verifyWebhook(
          typeof body === 'string' ? body : await request.text(),
          request.headers.get('stripe-signature'),
        );
      } catch {
        throw new AppError('INVALID_SIGNATURE', 'Webhook tidak terverifikasi.', 400);
      }
      if (!result) return { ok: true, ignored: true };
      const settled = await settlePayment(params.gateway, result);
      if (settled.outcome === 'review_required') set.status = 202;
      return settled;
    },
    { parse: 'text' },
  )
  .post(
    '/dev/pay/:orderId',
    async ({ params, user }) => {
      assertStubAllowed('payment');
      const u = user as AuthUser;
      const order = await db.query.orders.findFirst({
        where: and(eq(orders.id, z.string().uuid().parse(params.orderId)), eq(orders.userId, u.id)),
      });
      if (!order) throw new AppError('NOT_FOUND', 'Order tidak ditemukan.', 404);
      if (order.gateway !== 'stub' || !order.gatewayRef)
        throw new AppError('FORBIDDEN', 'Hanya Demo / Sample stub.', 403);
      return settlePayment('stub', {
        eventId: 'demo-' + order.id,
        orderId: order.id,
        gatewayRef: order.gatewayRef,
        status: 'paid',
        currency: 'IDR',
        amountMinor: amountMinor(order.amountIdr),
      });
    },
    { requireAuth: true },
  )
  .post(
    '/qris/receipts',
    async ({ request }) => {
      const config = qrisConfig();
      let raw: string;
      try {
        raw = await readReceiptBody(request);
      } catch {
        throw new AppError('BAD_RECEIPT', 'Receipt melebihi batas atau encoding tidak valid.', 400);
      }
      if (
        !verifyReceiptSignature(
          raw,
          request.headers.get('x-qris-timestamp'),
          request.headers.get('x-qris-signature'),
          config.secret,
        )
      )
        throw new AppError('INVALID_SIGNATURE', 'Receipt tidak terverifikasi.', 401);
      let payload: unknown;
      try {
        payload = JSON.parse(raw);
      } catch {
        throw new AppError('BAD_RECEIPT', 'Receipt JSON tidak valid.', 400);
      }
      return ingestReceipt(payload);
    },
    { parse: 'none' },
  )
  .get('/orders/:id', async ({ params, user }) => invoiceStatus((user as AuthUser).id, params.id), {
    requireAuth: true,
  })
  .get(
    '/orders/:id/qr',
    async ({ params, user }) => {
      const state = await invoiceStatus((user as AuthUser).id, params.id);
      if (state.status !== 'pending')
        throw new AppError('INVOICE_NOT_PAYABLE', 'Invoice tidak dapat dibayar.', 409);
      const invoice = await db.query.qrisInvoices.findFirst({
        where: and(
          eq(qrisInvoices.orderId, params.id),
          eq(qrisInvoices.userId, (user as AuthUser).id),
        ),
      });
      return new Response(
        await QRCode.toString(invoice!.qrPayload, {
          type: 'svg',
          errorCorrectionLevel: 'M',
          margin: 4,
        }),
        {
          headers: {
            'content-type': 'image/svg+xml',
            'cache-control': 'private, no-store',
            'x-content-type-options': 'nosniff',
            'content-security-policy': "default-src 'none'; sandbox",
          },
        },
      );
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
      const sub = await effectiveSubscription(u.id);
      return sub ?? null;
    },
    { requireAuth: true },
  )
  // Batalkan langganan: status canceled, akses sampai periode habis.
  .post(
    '/subscription/cancel',
    async ({ user }) => {
      const u = user as AuthUser;
      return withUserTransaction(u.id, async (tx) => {
        const sub = await effectiveSubscription(u.id, new Date(), tx);
        if (!sub) throw new AppError('NOT_FOUND', 'Tidak ada langganan aktif.', 404);
        if (sub.status === 'canceled') return sub;
        const [updated] = await tx
          .update(subscriptions)
          .set({ status: 'canceled', updatedAt: new Date() })
          .where(eq(subscriptions.id, sub.id))
          .returning();
        return updated!;
      });
    },
    { requireAuth: true },
  );
