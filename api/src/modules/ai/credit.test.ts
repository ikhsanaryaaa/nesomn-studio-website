import { describe, expect, it, afterAll, beforeAll } from 'bun:test';
import { eq } from 'drizzle-orm';
import { db } from '../../db/client.ts';
import { users, creditLedger } from '../../db/schema/index.ts';
import { getBalance, deductCredit, refundCredit } from './credit.ts';

/**
 * Unit test credit helper: potong, refund, idempotensi, dan tolak saldo
 * kurang. Butuh Postgres (docker compose up db + bun run db:migrate).
 */
describe('credit helper', () => {
  let userId: string;
  const email = `credit-${crypto.randomUUID()}@test.local`;

  beforeAll(async () => {
    const [u] = await db
      .insert(users)
      .values({ email, passwordHash: 'x', name: 'Credit Test', role: 'user' })
      .returning();
    userId = u.id;
    // Saldo awal 100 via entri grant.
    await db.insert(creditLedger).values({
      userId,
      delta: 100,
      reason: 'subscription_grant',
      balanceAfter: 100,
    });
  });

  afterAll(async () => {
    await db.delete(creditLedger).where(eq(creditLedger.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
  });

  it('membaca saldo awal', async () => {
    expect(await getBalance(userId)).toBe(100);
  });

  it('memotong credit dan menurunkan saldo', async () => {
    const after = await deductCredit(userId, 30, crypto.randomUUID());
    expect(after).toBe(70);
    expect(await getBalance(userId)).toBe(70);
  });

  it('menolak potong bila saldo kurang', async () => {
    await expect(deductCredit(userId, 999, crypto.randomUUID())).rejects.toThrow();
    // Saldo tidak berubah.
    expect(await getBalance(userId)).toBe(70);
  });

  it('refund mengembalikan credit', async () => {
    const refId = crypto.randomUUID();
    await deductCredit(userId, 20, refId);
    expect(await getBalance(userId)).toBe(50);
    const after = await refundCredit(userId, 20, refId);
    expect(after).toBe(70);
  });

  it('refund idempoten untuk refId yang sama', async () => {
    const refId = crypto.randomUUID();
    await deductCredit(userId, 10, refId);
    expect(await getBalance(userId)).toBe(60);
    await refundCredit(userId, 10, refId);
    const balanceAfterFirst = await getBalance(userId);
    expect(balanceAfterFirst).toBe(70);
    // Refund kedua tidak menambah saldo lagi.
    await refundCredit(userId, 10, refId);
    expect(await getBalance(userId)).toBe(70);
  });
});
