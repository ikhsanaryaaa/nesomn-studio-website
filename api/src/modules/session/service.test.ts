import { describe, expect, it, beforeEach } from 'bun:test';
import { eq } from 'drizzle-orm';
import { db } from '../../db/client.ts';
import { users, sessions } from '../../db/schema/index.ts';
import { createSession, enforceSessionLimit } from './service.ts';

/**
 * Integration test: butuh Postgres (jalankan `docker compose up db`
 * lalu `bun run db:migrate`). User tanpa subscription = Free Basic (limit 1).
 */
describe('session service', () => {
  let userId: string;

  beforeEach(async () => {
    const email = `session-test-${crypto.randomUUID()}@test.local`;
    const [u] = await db
      .insert(users)
      .values({ email, name: 'Session Test', role: 'user' })
      .returning({ id: users.id });
    userId = u.id;
  });

  it('membuat sesi baru dan mencatatnya', async () => {
    const id = await createSession(userId, 'test-agent', '127.0.0.1');
    const found = await db.query.sessions.findFirst({ where: eq(sessions.id, id) });
    expect(found).toBeTruthy();
    expect(found?.userId).toBe(userId);
  });

  it('menerapkan batas Free Basic (1): sesi terlama dihapus', async () => {
    // Sesi pertama, lalu sesi kedua harus menggusur yang pertama.
    const first = await createSession(userId, 'agent-1', '127.0.0.1');
    const second = await createSession(userId, 'agent-2', '127.0.0.1');

    const active = await db.query.sessions.findMany({ where: eq(sessions.userId, userId) });
    expect(active.length).toBe(1);
    expect(active[0].id).toBe(second);
    expect(active.find((s) => s.id === first)).toBeUndefined();
  });

  it('enforceSessionLimit idempotent saat di bawah batas', async () => {
    await enforceSessionLimit(userId); // tanpa sesi, tidak error
    const active = await db.query.sessions.findMany({ where: eq(sessions.userId, userId) });
    expect(active.length).toBe(0);
  });
});
