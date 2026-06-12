import { describe, expect, it, afterAll } from 'bun:test';
import { eq } from 'drizzle-orm';
import { app } from '../../index.ts';
import { db } from '../../db/client.ts';
import { users } from '../../db/schema/index.ts';

/**
 * Integration test alur auth: register -> /me -> logout.
 * Butuh Postgres (docker compose up db + bun run db:migrate).
 */
describe('auth flow', () => {
  const email = `auth-test-${crypto.randomUUID()}@test.local`;
  const password = 'secret12345';

  afterAll(async () => {
    await db.delete(users).where(eq(users.email, email));
  });

  function extractCookie(res: Response): string | null {
    const setCookie = res.headers.get('set-cookie');
    if (!setCookie) return null;
    return setCookie.split(';')[0]; // "nesomn_session=..."
  }

  it('register membuat user dan men-set cookie', async () => {
    const res = await app.handle(
      new Request('http://localhost/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password, name: 'Auth Test' }),
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { email: string; role: string };
    expect(body.email).toBe(email);
    expect(body.role).toBe('user');
    expect(extractCookie(res)).toContain('nesomn_session=');
  });

  it('login mengembalikan cookie valid dan /me mengenali user', async () => {
    const loginRes = await app.handle(
      new Request('http://localhost/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      }),
    );
    expect(loginRes.status).toBe(200);
    const cookie = extractCookie(loginRes);
    expect(cookie).toBeTruthy();

    const meRes = await app.handle(
      new Request('http://localhost/me', { headers: { cookie: cookie! } }),
    );
    expect(meRes.status).toBe(200);
    const me = (await meRes.json()) as { email: string };
    expect(me.email).toBe(email);
  });

  it('/me menolak tanpa cookie (401)', async () => {
    const res = await app.handle(new Request('http://localhost/me'));
    expect(res.status).toBe(401);
  });

  it('login dengan password salah ditolak (401)', async () => {
    const res = await app.handle(
      new Request('http://localhost/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password: 'wrongpass' }),
      }),
    );
    expect(res.status).toBe(401);
  });
});
