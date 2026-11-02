import './disposable.ts';
import { test, expect, afterAll } from 'bun:test';
import { eq } from '../../api/node_modules/drizzle-orm';
import { db } from '../../api/src/db/client.ts';
import {
  users,
  plans,
  subscriptions,
  orders,
  orderItems,
  paymentEvents,
} from '../../api/src/db/schema/index.ts';
import { getBalance, deductCredit, refundCredit } from '../../api/src/modules/ai/credit.ts';
import { settlePayment } from '../../api/src/modules/billing/settlement.ts';
import { addCalendarMonths } from '../../api/src/lib/periods.ts';
const ids: string[] = [],
  planIds: string[] = [],
  eventIds: string[] = [];
const benefits = {
  creditQuota: 10,
  maxConcurrentSessions: 1,
  code: 'sample-integrity',
  editorAccess: { scene2d: true, editor3d: true, proTemplates: true, aiVideo: true },
  cycle: 'monthly' as const,
  segment: 'individual' as const,
};
afterAll(async () => {
  for (const id of ids) await db.delete(users).where(eq(users.id, id));
  for (const id of planIds) await db.delete(plans).where(eq(plans.id, id));
  for (const id of eventIds) await db.delete(paymentEvents).where(eq(paymentEvents.eventId, id));
});
async function fixture() {
  const [u] = await db
    .insert(users)
    .values({ email: `sec-sub-${crypto.randomUUID()}@test.invalid`, name: 'Demo / Sample' })
    .returning();
  ids.push(u!.id);
  const [p] = await db
    .insert(plans)
    .values({ ...benefits, code: crypto.randomUUID(), name: 'Demo / Sample' })
    .returning();
  planIds.push(p!.id);
  return { user: u!, plan: p! };
}
test('annual quota expires monthly, missed months do not accumulate and old refund cannot revive quota', async () => {
  const { user, plan } = await fixture();
  await db
    .insert(subscriptions)
    .values({
      userId: user.id,
      planId: plan.id,
      status: 'canceled',
      cycle: 'yearly',
      segment: 'individual',
      benefits,
      currentPeriodStart: new Date('2028-01-31T12:00:00Z'),
      currentPeriodEnd: new Date('2029-01-31T12:00:00Z'),
    });
  const january = new Date('2028-02-01'),
    february = new Date('2028-03-01'),
    may = new Date('2028-05-05');
  expect(await getBalance(user.id, january)).toBe(10);
  const ref = crypto.randomUUID();
  await deductCredit(user.id, 3, ref, january);
  expect(await getBalance(user.id, february)).toBe(10);
  expect(await refundCredit(user.id, 3, ref, february)).toBe(10);
  expect(await getBalance(user.id, may)).toBe(10);
  expect(await getBalance(user.id, new Date('2029-02-01'))).toBe(0);
});
test('subscription fulfillment/renewal replay extends once and does not double current quota', async () => {
  const { user, plan } = await fixture();
  async function pay() {
    const [order] = await db
      .insert(orders)
      .values({
        userId: user.id,
        type: 'subscription',
        amountIdr: '100',
        gateway: 'stripe',
        gatewayRef: crypto.randomUUID(),
      })
      .returning();
    await db
      .insert(orderItems)
      .values({ orderId: order!.id, refType: 'plan', refId: plan.id, benefitSnapshot: benefits });
    const event = {
      eventId: crypto.randomUUID(),
      orderId: order!.id,
      gatewayRef: order!.gatewayRef!,
      amountMinor: 10000,
      currency: 'IDR' as const,
      status: 'paid' as const,
    };
    eventIds.push(event.eventId);
    await Promise.all(Array.from({ length: 10 }, () => settlePayment('stripe', event)));
  }
  await pay();
  const first = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, user.id),
  });
  await pay();
  const rows = await db.query.subscriptions.findMany({ where: eq(subscriptions.userId, user.id) });
  expect(rows).toHaveLength(1);
  expect(rows[0]!.currentPeriodEnd?.toISOString()).toBe(
    addCalendarMonths(first!.currentPeriodStart!, 2).toISOString(),
  );
  expect(await getBalance(user.id)).toBe(10);
});
