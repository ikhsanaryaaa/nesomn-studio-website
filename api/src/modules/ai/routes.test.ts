import { describe, expect, it, afterAll, beforeAll } from 'bun:test';
import { eq, inArray } from 'drizzle-orm';
import { app } from '../../index.ts';
import { db } from '../../db/client.ts';
import { users, aiProviders, aiJobs, creditLedger } from '../../db/schema/index.ts';

/**
 * Integration test AI Job API: guard auth, saldo kurang, 1 job/user.
 * Butuh Postgres (docker compose up db + bun run db:migrate).
 */
describe('ai job api', () => {
  const email = `ai-${crypto.randomUUID()}@test.local`;
  const password = 'secret12345';
  let userId = '';
  let providerId = '';

  function extractCookie(res: Response): string {
    const setCookie = res.headers.get('set-cookie');
    return setCookie ? setCookie.split(';')[0] : '';
  }

  let cookie = '';

  beforeAll(async () => {
    const res = await app.handle(
      new Request('http://localhost/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password, name: 'AI Test' }),
      }),
    );
    cookie = extractCookie(res);
    const u = await db.query.users.findFirst({ where: eq(users.email, email) });
    userId = u!.id;

    // Provider stub (creditCost 10, terbuka untuk semua tier).
    const [p] = await db
      .insert(aiProviders)
      .values({
        key: `stub-${crypto.randomUUID()}`,
        kind: 'image',
        modelName: 'stub-image',
        tab: 'scene',
        enabled: true,
        creditCost: 10,
        tierAccess: [],
      })
      .returning();
    providerId = p.id;
  });

  afterAll(async () => {
    await db.delete(aiJobs).where(eq(aiJobs.userId, userId));
    await db.delete(creditLedger).where(eq(creditLedger.userId, userId));
    await db.delete(aiProviders).where(eq(aiProviders.id, providerId));
    await db.delete(users).where(inArray(users.email, [email]));
  });

  it('menolak akses tanpa auth (401)', async () => {
    const res = await app.handle(new Request('http://localhost/ai/credit'));
    expect(res.status).toBe(401);
  });

  it('menolak buat job bila saldo kurang (402)', async () => {
    const res = await app.handle(
      new Request('http://localhost/ai/jobs', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({
          providerId,
          tab: 'scene',
          input: { prompt: 'kucing astronot', aspect: '1:1' },
        }),
      }),
    );
    expect(res.status).toBe(402);
  });

  it('membuat job saat saldo cukup lalu menolak job kedua (409)', async () => {
    // Beri saldo 100.
    await db.insert(creditLedger).values({
      userId,
      delta: 100,
      reason: 'subscription_grant',
      balanceAfter: 100,
    });

    const first = await app.handle(
      new Request('http://localhost/ai/jobs', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({
          providerId,
          tab: 'scene',
          input: { prompt: 'kucing astronot', aspect: '1:1' },
        }),
      }),
    );
    expect(first.status).toBe(200);
    const job = (await first.json()) as { id: string; status: string; creditCost: number };
    expect(job.status).toBe('pending');
    expect(job.creditCost).toBe(10);

    // Job kedua ditolak (masih ada job aktif).
    const second = await app.handle(
      new Request('http://localhost/ai/jobs', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({
          providerId,
          tab: 'scene',
          input: { prompt: 'lagi', aspect: '1:1' },
        }),
      }),
    );
    expect(second.status).toBe(409);

    // Saldo terpotong 10 -> 90.
    const creditRes = await app.handle(
      new Request('http://localhost/ai/credit', { headers: { cookie } }),
    );
    const { balance } = (await creditRes.json()) as { balance: number };
    expect(balance).toBe(90);
  });
});
