import '../security/disposable.ts';
import { test, expect, afterAll } from 'bun:test';
import { createHash } from 'node:crypto';
import { eq } from '../../api/node_modules/drizzle-orm';
import { db } from '../../api/src/db/client.ts';
import {
  users,
  creditPacks,
  orders,
  qrisInvoices,
  qrisReceipts,
} from '../../api/src/db/schema/index.ts';
import { crc16 } from '../../api/src/modules/billing/qris/pure.ts';
import {
  createInvoice,
  ingestReceipt,
  invoiceStatus,
} from '../../api/src/modules/billing/qris/service.ts';
import { getBalance } from '../../api/src/modules/ai/credit.ts';
const raw = '00020101021126100006SAMPLE5204000053033605802ID5904DEMO6004TEST6304',
  qr = raw + crc16(raw);
Object.assign(process.env, {
  QRIS_ENABLED: 'true',
  QRIS_MERCHANT_ID: '991' + String(Date.now()),
  QRIS_STORE_ID: '1',
  QRIS_STATIC_PAYLOAD: qr,
  QRIS_TEMPLATE_SHA256: createHash('sha256').update(qr).digest('hex'),
  QRIS_EXPECTED_NAME: 'DEMO',
  QRIS_RECEIPT_SECRET: 'synthetic-qris-secret-minimum-32-characters',
});
const ids: string[] = [],
  packs: string[] = [];
afterAll(async () => {
  for (const id of ids) {
    const invoices = await db.query.qrisInvoices.findMany({ where: eq(qrisInvoices.userId, id) });
    for (const inv of invoices)
      await db.delete(qrisReceipts).where(eq(qrisReceipts.orderId, inv.orderId));
    await db.delete(users).where(eq(users.id, id));
  }
  for (const id of packs) await db.delete(creditPacks).where(eq(creditPacks.id, id));
});
async function fixture() {
  const [u] = await db
    .insert(users)
    .values({ email: `qris-${crypto.randomUUID()}@test.invalid`, name: 'Demo / Sample' })
    .returning();
  ids.push(u!.id);
  const [p] = await db
    .insert(creditPacks)
    .values({
      code: crypto.randomUUID(),
      name: 'Demo / Sample',
      credits: 10,
      priceIdr: '100',
      priceUsd: '1',
    })
    .returning();
  packs.push(p!.id);
  return {
    user: u!,
    input: { type: 'topup' as const, gateway: 'qris' as const, creditPackId: p!.id },
  };
}
function receipt(inv: typeof qrisInvoices.$inferSelect, patch = {}) {
  return {
    merchantId: inv.merchantId,
    storeId: inv.storeId,
    reference: crypto.randomUUID(),
    amountIdr: inv.payableIdr,
    createdAt: Math.ceil(inv.createdAt.getTime() / 1000) + 1,
    status: 3,
    completed: true,
    ...patch,
  };
}
test('parallel checkout reserves unique amounts and same request returns one order', async () => {
  const { user, input } = await fixture();
  const results = await Promise.all(
    Array.from({ length: 8 }, (_, i) => createInvoice(user.id, input, 'request-' + i)),
  );
  const rows = await db.query.qrisInvoices.findMany({ where: eq(qrisInvoices.userId, user.id) });
  expect(new Set(rows.map((r) => r.payableIdr)).size).toBe(8);
  const replay = await createInvoice(user.id, input, 'request-0');
  expect(replay.order.id).toBe(results[0]!.order.id);
  await expect(
    createInvoice(user.id, { ...input, type: 'subscription' }, 'request-0'),
  ).rejects.toThrow();
});
test('authenticated normalized receipt applies once; changed replay and invalid scope/completion reject', async () => {
  const { user, input } = await fixture();
  const { order } = await createInvoice(user.id, input, 'receipt');
  const inv = (await db.query.qrisInvoices.findFirst({
    where: eq(qrisInvoices.orderId, order.id),
  }))!;
  const event = receipt(inv);
  await Promise.all(Array.from({ length: 8 }, () => ingestReceipt(event)));
  expect(await getBalance(user.id)).toBe(10);
  await expect(ingestReceipt({ ...event, amountIdr: event.amountIdr + 1 })).rejects.toThrow();
  await expect(ingestReceipt(receipt(inv, { storeId: '999' }))).rejects.toThrow();
  await expect(ingestReceipt(receipt(inv, { completed: false, status: 1 }))).rejects.toThrow();
  expect((await invoiceStatus(user.id, order.id)).status).toBe('paid');
  await expect(invoiceStatus(crypto.randomUUID(), order.id)).rejects.toThrow();
});
test('late/unmatched/second receipt are reviewable without false paid or extra credits', async () => {
  const { user, input } = await fixture();
  const { order } = await createInvoice(user.id, input, 'late', new Date(Date.now() - 3600000));
  const inv = (await db.query.qrisInvoices.findFirst({
    where: eq(qrisInvoices.orderId, order.id),
  }))!;
  expect(
    (await ingestReceipt(receipt(inv, { createdAt: Math.floor(Date.now() / 1000) }))).outcome,
  ).toBe('review_required');
  expect((await db.query.orders.findFirst({ where: eq(orders.id, order.id) }))?.status).toBe(
    'pending',
  );
  expect(await getBalance(user.id)).toBe(0);
  expect((await ingestReceipt(receipt(inv, { amountIdr: 999999999 }))).outcome).toBe('unmatched');
});

test('HTTP checkout requires auth/key; raw HMAC ingestion and SVG QR enforce server truth', async () => {
  const { app } = await import('../../api/src/index.ts');
  const { createSession } = await import('../../api/src/modules/session/service.ts');
  const { signToken } = await import('../../api/src/lib/jwt.ts');
  const { signReceipt } = await import('../../api/src/modules/billing/qris/pure.ts');
  const { user, input } = await fixture();
  const sid = await createSession(user.id, null, null),
    cookie = 'nesomn_session=' + (await signToken({ sub: user.id, sessionId: sid, role: 'user' }));
  const headers = {
    'content-type': 'application/json',
    cookie,
    'idempotency-key': 'http-checkout',
  };
  const checkout = await app.handle(
    new Request('http://localhost/billing/checkout', {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...input, amountIdr: 1, status: 'paid' }),
    }),
  );
  expect(checkout.status).toBe(200);
  const result = await checkout.json();
  const svg = await app.handle(
    new Request(`http://localhost/billing/orders/${result.order.id}/qr`, { headers: { cookie } }),
  );
  expect(svg.status).toBe(200);
  expect(svg.headers.get('content-type')).toContain('image/svg');
  expect(
    (await app.handle(new Request(`http://localhost/billing/orders/${result.order.id}`))).status,
  ).toBe(401);
  const inv = (await db.query.qrisInvoices.findFirst({
    where: eq(qrisInvoices.orderId, result.order.id),
  }))!;
  const rawBody = JSON.stringify(receipt(inv));
  const stamp = Math.floor(Date.now() / 1000);
  const bad = await app.handle(
    new Request('http://localhost/billing/qris/receipts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: rawBody,
    }),
  );
  expect(bad.status).toBe(401);
  const good = await app.handle(
    new Request('http://localhost/billing/qris/receipts', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-qris-timestamp': String(stamp),
        'x-qris-signature': signReceipt(rawBody, stamp, process.env.QRIS_RECEIPT_SECRET!),
      },
      body: rawBody,
    }),
  );
  expect(good.status).toBe(200);
  expect(await getBalance(user.id)).toBe(10);
  expect((await invoiceStatus(user.id, result.order.id)).status).toBe('paid');
});

test('incompatible subscription is rejected before checkout and settlement race enters explicit review', async () => {
  const { plans, subscriptions } = await import('../../api/src/db/schema/index.ts');
  const { user } = await fixture();
  const access = { scene2d: true, editor3d: false, proTemplates: true, aiVideo: true };
  const [a, b] = await db
    .insert(plans)
    .values([
      {
        code: crypto.randomUUID(),
        name: 'Demo A',
        segment: 'individual',
        cycle: 'monthly',
        priceIdr: '100',
        editorAccess: access,
      },
      {
        code: crypto.randomUUID(),
        name: 'Demo B',
        segment: 'individual',
        cycle: 'monthly',
        priceIdr: '100',
        editorAccess: access,
      },
    ])
    .returning();
  const active = {
    userId: user.id,
    planId: a!.id,
    status: 'active' as const,
    cycle: 'monthly' as const,
    segment: 'individual' as const,
    currentPeriodStart: new Date(Date.now() - 1000),
    currentPeriodEnd: new Date(Date.now() + 86400000),
  };
  try {
    await db.insert(subscriptions).values(active);
    await expect(
      createInvoice(
        user.id,
        { type: 'subscription', gateway: 'qris', planId: b!.id },
        'incompatible',
      ),
    ).rejects.toThrow();
    await db.delete(subscriptions).where(eq(subscriptions.userId, user.id));
    const { order } = await createInvoice(
      user.id,
      { type: 'subscription', gateway: 'qris', planId: b!.id },
      'race',
    );
    await db.insert(subscriptions).values(active);
    const inv = (await db.query.qrisInvoices.findFirst({
      where: eq(qrisInvoices.orderId, order.id),
    }))!;
    expect((await ingestReceipt(receipt(inv))).outcome).toBe('review_required');
    expect((await invoiceStatus(user.id, order.id)).status).toBe('review_required');
    expect((await db.query.orders.findFirst({ where: eq(orders.id, order.id) }))?.status).toBe(
      'pending',
    );
  } finally {
    await db.delete(subscriptions).where(eq(subscriptions.userId, user.id));
    await db.delete(plans).where(eq(plans.id, a!.id));
    await db.delete(plans).where(eq(plans.id, b!.id));
  }
});
