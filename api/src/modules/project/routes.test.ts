import { describe, expect, it, afterAll } from 'bun:test';
import { inArray } from 'drizzle-orm';
import { app } from '../../index.ts';
import { db } from '../../db/client.ts';
import { users } from '../../db/schema/index.ts';

/**
 * Integration test Project API: CRUD + enforcement ownership.
 * Butuh Postgres (docker compose up db + bun run db:migrate).
 */
describe('project crud + ownership', () => {
  const emailA = `proj-a-${crypto.randomUUID()}@test.local`;
  const emailB = `proj-b-${crypto.randomUUID()}@test.local`;
  const password = 'secret12345';

  afterAll(async () => {
    await db.delete(users).where(inArray(users.email, [emailA, emailB]));
  });

  function extractCookie(res: Response): string {
    const setCookie = res.headers.get('set-cookie');
    return setCookie ? setCookie.split(';')[0] : '';
  }

  async function register(email: string): Promise<string> {
    const res = await app.handle(
      new Request('http://localhost/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password, name: 'Proj Test' }),
      }),
    );
    expect(res.status).toBe(201);
    return extractCookie(res);
  }

  it('create + get + list + update + delete oleh pemilik, tolak user lain', async () => {
    const cookieA = await register(emailA);
    const cookieB = await register(emailB);

    // create (user A)
    const createRes = await app.handle(
      new Request('http://localhost/projects', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: cookieA },
        body: JSON.stringify({
          title: 'Scene Pertama',
          kind: 'scene2d',
          state: { canvas: { width: 800, height: 600, background: '#fff' }, objects: [] },
        }),
      }),
    );
    expect(createRes.status).toBe(200);
    const project = (await createRes.json()) as { id: string; title: string };
    expect(project.title).toBe('Scene Pertama');

    // get oleh pemilik
    const getOwn = await app.handle(
      new Request(`http://localhost/projects/${project.id}`, { headers: { cookie: cookieA } }),
    );
    expect(getOwn.status).toBe(200);

    // list oleh pemilik (minimal 1)
    const listRes = await app.handle(
      new Request('http://localhost/projects', { headers: { cookie: cookieA } }),
    );
    expect(listRes.status).toBe(200);
    const list = (await listRes.json()) as Array<{ id: string }>;
    expect(list.some((p) => p.id === project.id)).toBe(true);

    // user B tidak boleh akses project user A (404)
    const getOther = await app.handle(
      new Request(`http://localhost/projects/${project.id}`, { headers: { cookie: cookieB } }),
    );
    expect(getOther.status).toBe(404);

    // user B tidak boleh update
    const updOther = await app.handle(
      new Request(`http://localhost/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', cookie: cookieB },
        body: JSON.stringify({ title: 'Hijack' }),
      }),
    );
    expect(updOther.status).toBe(404);

    // update oleh pemilik
    const updOwn = await app.handle(
      new Request(`http://localhost/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', cookie: cookieA },
        body: JSON.stringify({ title: 'Scene Diubah' }),
      }),
    );
    expect(updOwn.status).toBe(200);
    const updated = (await updOwn.json()) as { title: string };
    expect(updated.title).toBe('Scene Diubah');

    // user B tidak boleh delete
    const delOther = await app.handle(
      new Request(`http://localhost/projects/${project.id}`, {
        method: 'DELETE',
        headers: { cookie: cookieB },
      }),
    );
    expect(delOther.status).toBe(404);

    // delete oleh pemilik
    const delOwn = await app.handle(
      new Request(`http://localhost/projects/${project.id}`, {
        method: 'DELETE',
        headers: { cookie: cookieA },
      }),
    );
    expect(delOwn.status).toBe(200);

    // setelah dihapus, get 404
    const getGone = await app.handle(
      new Request(`http://localhost/projects/${project.id}`, { headers: { cookie: cookieA } }),
    );
    expect(getGone.status).toBe(404);
  });

  it('menolak akses tanpa auth (401)', async () => {
    const res = await app.handle(new Request('http://localhost/projects'));
    expect(res.status).toBe(401);
  });
});
