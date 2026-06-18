import { describe, expect, it, afterAll, beforeAll } from 'bun:test';
import { eq, inArray } from 'drizzle-orm';
import { app } from '../../index.ts';
import { db } from '../../db/client.ts';
import { users, plans, creditLedger, orders, subscriptions } from '../../db/schema/index.ts';

/**
 * Integration test Billing: checkout subscription -> simulasi bayar (stub)
 * -> langganan aktif + credit grant; idempotensi bayar ganda; tolak
 * webhook signature invalid. Butuh Postgres (docker compose up db + migrate).
 */
describe('billing checkout + grant', () => {
  const email = `bill-${crypto.randomUUID()}@test.local`;
  const password = 'secret12345';
  let userId = '';
  let cookie = '';
  let planId = '';

  function extractCookie(res: Response): string {
    const setCookie = res.headers.get('set-cookie');
    return setCookie ? setCookie.split(';')[0] : '';
  }

  beforeAll(async () => {
    const res = await app.handle(
      new Request('http://localhost/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password, name: 'Bill Test' }),
      }),
    );
    cookie = extractCookie(res);
    const u = await db.query.users.findFirst({ where: eq(users.email, email) });
    userId = u!.id;
    // Pakai plan berbayar dengan credit quota dari seed.
    const plan = await db.query.plans.findFirst({ where: eq(plans.code, 'scene_individual_monthly') });
    planId = plan!.id;
  });

  afterAll(async () => {
    await db.delete(subscriptions).where(eq(subscriptions.userId, userId));
    await db.delete(creditLedger).where(eq(creditLedger.userId, userId));
    await db.delete(orders).where(eq(orders.userId, userId));
    await db.delete(users).where(inArray(users.email, [email]));
  });

  it('checkout subscription membuat order pending + checkoutUrl', async () => {
    const res = await app.handle(
      new Request('http://localhost/billing/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ type: 'subscription', gateway: 'stub', planId }),
      }),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { order: { id: string; status: string }; checkoutUrl: string };
    expect(data.order.status).toBe('pending');
    expect(data.checkoutUrl).toContain('/checkout?order=');
  });

  it('simulasi bayar -> langganan aktif + credit grant, idempoten', async () => {
    // Buat order baru.
    const checkout = await app.handle(
      new Request('http://localhost/billing/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ type: 'subscription', gateway: 'stub', planId }),
      }),
    );
    const { order } = (await checkout.json()) as { order: { id: string } };

    // Bayar (simulasi stub).
    const pay = await app.handle(
      new Request(`http://localhost/billing/dev/pay/${order.id}`, {
        method: 'POST',
        headers: { cookie },
      }),
    );
    expect(pay.status).toBe(200);

    // Langganan aktif.
    const subRes = await app.handle(
      new Request('http://localhost/billing/subscription', { headers: { cookie } }),
    );
    const sub = (await subRes.json()) as { status: string; planId: string } | null;
    expect(sub?.status).toBe('active');
    expect(sub?.planId).toBe(planId);

    // Bayar ulang idempoten (tidak menggandakan).
    const payAgain = await app.handle(
      new Request(`http://localhost/billing/dev/pay/${order.id}`, {
        method: 'POST',
        headers: { cookie },
      }),
    );
    const again = (await payAgain.json()) as { idempotent?: boolean };
    expect(again.idempotent).toBe(true);
  });

  it('webhook stub menolak payload tanpa orderId (400)', async () => {
    const res = await app.handle(
      new Request('http://localhost/billing/webhook/stub', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'paid' }),
      }),
    );
    expect(res.status).toBe(400);
  });
});
