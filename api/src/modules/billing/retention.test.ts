import { describe, expect, it, afterAll, beforeAll } from 'bun:test';
import { eq } from 'drizzle-orm';
import { db } from '../../db/client.ts';
import { users, plans, subscriptions } from '../../db/schema/index.ts';
import { selectExpiredUserIds, retentionCutoff, RETENTION_DAYS } from './retention.ts';

/**
 * Unit test logika seleksi retention (tanpa hapus nyata). Butuh Postgres.
 */
describe('retention selection', () => {
  let expiredUserId = '';
  let activeUserId = '';
  let planId = '';
  const emailExpired = `ret-exp-${crypto.randomUUID()}@test.local`;
  const emailActive = `ret-act-${crypto.randomUUID()}@test.local`;

  beforeAll(async () => {
    const plan = await db.query.plans.findFirst({ where: eq(plans.code, 'scene_individual_monthly') });
    planId = plan!.id;

    const [exp] = await db
      .insert(users)
      .values({ email: emailExpired, passwordHash: 'x', name: 'Expired', role: 'user' })
      .returning();
    expiredUserId = exp.id;
    const [act] = await db
      .insert(users)
      .values({ email: emailActive, passwordHash: 'x', name: 'Active', role: 'user' })
      .returning();
    activeUserId = act.id;

    const now = new Date();
    // User kedaluwarsa: langganan expired, periode berakhir 40 hari lalu.
    const longAgo = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000);
    await db.insert(subscriptions).values({
      userId: expiredUserId,
      planId,
      status: 'expired',
      cycle: 'monthly',
      segment: 'individual',
      currentPeriodStart: new Date(longAgo.getTime() - 30 * 24 * 60 * 60 * 1000),
      currentPeriodEnd: longAgo,
    });
    // User aktif: langganan masih berjalan.
    await db.insert(subscriptions).values({
      userId: activeUserId,
      planId,
      status: 'active',
      cycle: 'monthly',
      segment: 'individual',
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    });
  });

  afterAll(async () => {
    await db.delete(subscriptions).where(eq(subscriptions.userId, expiredUserId));
    await db.delete(subscriptions).where(eq(subscriptions.userId, activeUserId));
    await db.delete(users).where(eq(users.id, expiredUserId));
    await db.delete(users).where(eq(users.id, activeUserId));
  });

  it('cutoff berada 30 hari sebelum sekarang', () => {
    const now = new Date('2026-06-18T00:00:00Z');
    const cutoff = retentionCutoff(now);
    const diffDays = (now.getTime() - cutoff.getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBe(RETENTION_DAYS);
  });

  it('menyertakan user kedaluwarsa, mengecualikan user aktif', async () => {
    const ids = await selectExpiredUserIds();
    expect(ids).toContain(expiredUserId);
    expect(ids).not.toContain(activeUserId);
  });
});
