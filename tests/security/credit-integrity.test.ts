import './disposable.ts';
import { beforeAll, afterAll, expect, test } from 'bun:test';
import { eq } from '../../api/node_modules/drizzle-orm';
import { db, sql } from '../../api/src/db/client.ts';
import { users, creditLedger, creditAccounts } from '../../api/src/db/schema/index.ts';
import {
  adjustCredit,
  deductCredit,
  refundCredit,
  getBalance,
} from '../../api/src/modules/ai/credit.ts';

if (process.env.NESOMN_DISPOSABLE_TESTS !== '1')
  throw new Error('Disposable security integration only');
const ids: string[] = [];
beforeAll(async () => {
  const [identity] = await sql`SELECT current_database() AS db, current_user AS role`;
  if (identity?.db !== 'nesomn_revision_test' || identity.role !== 'nesomn_test')
    throw new Error('Wrong test DB');
});
afterAll(async () => {
  for (const id of ids) await db.delete(users).where(eq(users.id, id));
});
async function user() {
  const [row] = await db
    .insert(users)
    .values({
      email: `sec-credit-${crypto.randomUUID()}@test.invalid`,
      name: 'Demo / Sample integrity test',
      passwordHash: 'not-a-login',
    })
    .returning();
  ids.push(row!.id);
  return row!.id;
}

test('parallel grants/debits/refunds serialize on user and never double charge/refund', async () => {
  const id = await user();
  await Promise.all(
    Array.from({ length: 40 }, (_, i) => adjustCredit(id, 1, `fixture-${id}-${i}`)),
  );
  expect(await getBalance(id)).toBe(40);
  const refs = Array.from({ length: 30 }, () => crypto.randomUUID());
  const results = await Promise.allSettled(refs.map((ref) => deductCredit(id, 3, ref)));
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(13);
  expect(await getBalance(id)).toBe(1);
  const index = results.findIndex((result) => result.status === 'fulfilled');
  await Promise.all(Array.from({ length: 12 }, () => refundCredit(id, 3, refs[index]!)));
  expect(await getBalance(id)).toBe(4);
  await expect(refundCredit(id, 999, refs[index]!)).rejects.toThrow();
  await expect(refundCredit(id, 3, crypto.randomUUID())).rejects.toThrow();
  expect(await getBalance(id)).toBe(4);
});

test('same debit reference is idempotent and cannot be reused with another amount', async () => {
  const id = await user();
  await adjustCredit(id, 20, `fixture-${id}`);
  const ref = crypto.randomUUID();
  await Promise.all(Array.from({ length: 10 }, () => deductCredit(id, 5, ref)));
  expect(await getBalance(id)).toBe(15);
  await expect(deductCredit(id, 6, ref)).rejects.toThrow();
  const entries = await db.query.creditLedger.findMany({ where: eq(creditLedger.refId, ref) });
  expect(entries).toHaveLength(1);
});

test('expiry is auditable and refund never resurrects expired credits', async () => {
  const id = await user();
  const before = new Date('2030-01-01T00:00:00Z');
  const expires = new Date('2030-02-01T00:00:00Z');
  const after = new Date('2030-02-02T00:00:00Z');
  await adjustCredit(id, 10, `fixture-${id}`, expires, before);
  const ref = crypto.randomUUID();
  await deductCredit(id, 10, ref, before);
  expect(await refundCredit(id, 10, ref, after)).toBe(0);
  expect(await refundCredit(id, 10, ref, after)).toBe(0);
  expect(await getBalance(id, after)).toBe(0);
});

test('legacy balance inconsistency is preserved and blocked for reconciliation', async () => {
  const id = await user();
  await db.insert(creditLedger).values([
    {
      userId: id,
      delta: 100,
      balanceAfter: 100,
      reason: 'topup',
      createdAt: new Date('2026-01-01'),
    },
    {
      userId: id,
      delta: -10,
      balanceAfter: 95,
      reason: 'usage',
      createdAt: new Date('2026-01-02'),
    },
  ]);
  await expect(getBalance(id)).rejects.toThrow(/rekonsiliasi/i);
  expect(
    await db.query.creditAccounts.findFirst({ where: eq(creditAccounts.userId, id) }),
  ).toBeUndefined();
  expect(
    (await db.query.creditLedger.findMany({ where: eq(creditLedger.userId, id) }))
      .map((row) => row.balanceAfter)
      .sort(),
  ).toEqual([100, 95].sort());
});

test('financial refund remains possible after disabling login, without granting new sessions', async () => {
  const id = await user();
  await adjustCredit(id, 10, 'fixture-disabled');
  const ref = crypto.randomUUID();
  await deductCredit(id, 3, ref);
  await db.update(users).set({ disabledAt: new Date() }).where(eq(users.id, id));
  expect(await refundCredit(id, 3, ref)).toBe(10);
  const { createSession } = await import('../../api/src/modules/session/service.ts');
  await expect(createSession(id, null, null)).rejects.toThrow();
});
