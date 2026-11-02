import './disposable.ts';
import { test, expect, afterAll } from 'bun:test';
import { eq } from '../../api/node_modules/drizzle-orm';
import { db, sql } from '../../api/src/db/client.ts';
import {
  users,
  creditPacks,
  orders,
  orderItems,
  orderFulfillments,
  paymentEvents,
} from '../../api/src/db/schema/index.ts';
import { settlePayment } from '../../api/src/modules/billing/settlement.ts';
import { getBalance } from '../../api/src/modules/ai/credit.ts';

if (process.env.NESOMN_DISPOSABLE_TESTS !== '1') throw new Error('Disposable only');
const ids: string[] = [],
  packs: string[] = [],
  events: string[] = [];
afterAll(async () => {
  for (const id of ids) await db.delete(users).where(eq(users.id, id));
  for (const id of packs) await db.delete(creditPacks).where(eq(creditPacks.id, id));
  for (const id of events) await db.delete(paymentEvents).where(eq(paymentEvents.eventId, id));
});
async function fixture() {
  const [identity] = await sql`select current_database() db,current_user role`;
  if (identity?.db !== 'nesomn_revision_test' || identity.role !== 'nesomn_test')
    throw new Error('Wrong DB');
  const [u] = await db
    .insert(users)
    .values({ email: `sec-settle-${crypto.randomUUID()}@test.invalid`, name: 'Demo / Sample' })
    .returning();
  ids.push(u!.id);
  const [pack] = await db
    .insert(creditPacks)
    .values({
      code: crypto.randomUUID(),
      name: 'Demo / Sample',
      credits: 10,
      priceIdr: '100',
      priceUsd: '1',
    })
    .returning();
  packs.push(pack!.id);
  const [order] = await db
    .insert(orders)
    .values({
      userId: u!.id,
      type: 'topup',
      amountIdr: '100',
      gateway: 'stripe',
      gatewayRef: crypto.randomUUID(),
    })
    .returning();
  await db.insert(orderItems).values({
    orderId: order!.id,
    refType: 'credit_pack',
    refId: pack!.id,
    benefitSnapshot: { credits: 10 },
  });
  const event = {
    eventId: crypto.randomUUID(),
    orderId: order!.id,
    gatewayRef: order!.gatewayRef!,
    amountMinor: 10000,
    currency: 'IDR' as const,
    status: 'paid' as const,
  };
  events.push(event.eventId);
  return { user: u!, order: order!, event };
}
test('parallel verified settlement grants once; wrong amount/replay payload fails', async () => {
  const { user, order, event } = await fixture();
  await expect(settlePayment('stripe', { ...event, amountMinor: 999 })).rejects.toThrow();
  await db.delete(paymentEvents).where(eq(paymentEvents.eventId, event.eventId));
  await Promise.all(Array.from({ length: 12 }, () => settlePayment('stripe', event)));
  expect(await getBalance(user.id)).toBe(10);
  expect((await db.query.orders.findFirst({ where: eq(orders.id, order.id) }))?.status).toBe(
    'paid',
  );
  await expect(settlePayment('stripe', { ...event, amountMinor: 10001 })).rejects.toThrow();
  expect(await getBalance(user.id)).toBe(10);
});
test('legacy marker requires review and leaves pending history unchanged', async () => {
  const { user, order, event } = await fixture();
  await db.insert(orderFulfillments).values({ orderId: order.id, state: 'legacy_review' });
  expect((await settlePayment('stripe', event)).outcome).toBe('review_required');
  expect(await getBalance(user.id)).toBe(0);
  expect((await db.query.orders.findFirst({ where: eq(orders.id, order.id) }))?.status).toBe(
    'pending',
  );
});

test('failed fulfillment rolls back paid and grant together while retaining verified receipt', async () => {
  const { user, order, event } = await fixture();
  await db.delete(orderItems).where(eq(orderItems.orderId, order.id));
  await expect(settlePayment('stripe', event)).rejects.toThrow();
  expect((await db.query.orders.findFirst({ where: eq(orders.id, order.id) }))?.status).toBe(
    'pending',
  );
  expect(
    (await db.query.paymentEvents.findFirst({ where: eq(paymentEvents.eventId, event.eventId) }))
      ?.outcome,
  ).toBe('received');
  expect(await getBalance(user.id)).toBe(0);
  await db.insert(orderItems).values({
    orderId: order.id,
    refType: 'credit_pack',
    refId: packs.at(-1)!,
    benefitSnapshot: { credits: 10 },
  });
  await settlePayment('stripe', event);
  expect(await getBalance(user.id)).toBe(10);
});

test('one physical provider receipt cannot fulfill two different orders', async () => {
  const a = await fixture(),
    b = await fixture();
  await db.update(orders).set({ gatewayRef: a.event.gatewayRef }).where(eq(orders.id, b.order.id));
  await settlePayment('stripe', a.event);
  await expect(
    settlePayment('stripe', { ...b.event, gatewayRef: a.event.gatewayRef }),
  ).rejects.toThrow();
  expect(await getBalance(b.user.id)).toBe(0);
});

test('alternate event for fulfilled receipt is durably marked applied', async () => {
  const { order, event } = await fixture();
  await settlePayment('stripe', event);
  const second = { ...event, eventId: crypto.randomUUID() };
  events.push(second.eventId);
  await settlePayment('stripe', second);
  expect(
    (await db.query.paymentEvents.findFirst({ where: eq(paymentEvents.eventId, second.eventId) }))
      ?.outcome,
  ).toBe('applied');
  expect((await db.query.orders.findFirst({ where: eq(orders.id, order.id) }))?.status).toBe(
    'paid',
  );
});
