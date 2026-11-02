import './disposable';
import { expect, test } from 'bun:test';
import { eq } from '../../api/node_modules/drizzle-orm';
import { app } from '../../api/src/index';
import { db } from '../../api/src/db/client';
import { users, assets, licenses } from '../../api/src/db/schema';
import { createSession } from '../../api/src/modules/session/service';
import { signToken } from '../../api/src/lib/jwt';

test('stable and legacy editor image resolution recheck license and never fetch arbitrary URLs', async () => {
  const createdUsers: string[] = [];
  let assetId: string | undefined;
  try {
    const cookies: string[] = [];
    for (const label of ['owner', 'other']) {
      const [user] = await db
        .insert(users)
        .values({ email: crypto.randomUUID() + '@test.invalid', name: label })
        .returning();
      createdUsers.push(user!.id);
      const token = await signToken({
        sub: user!.id,
        role: user!.role,
        sessionId: await createSession(user!.id, null, null),
      });
      cookies.push('nesomn_session=' + token);
    }
    const slug = 'test-image-' + crypto.randomUUID();
    const key = 'private/' + slug + '.png';
    const [asset] = await db
      .insert(assets)
      .values({
        slug,
        title: 'Synthetic image',
        type: 'mockup2d',
        status: 'published',
        tier: 'pro',
        isSubscriptionAsset: false,
        fileKey: key,
      })
      .returning();
    assetId = asset!.id;
    await db.insert(licenses).values({ userId: createdUsers[0]!, assetId });
    const request = (cookie?: string) =>
      app.handle(
        new Request('http://localhost/catalog/editor-image/' + slug, {
          headers: cookie ? { cookie } : {},
        }),
      );
    expect((await request()).status).toBe(401);
    expect((await request(cookies[1])).status).toBe(403);
    const response = await request(cookies[0]);
    expect(response.status).toBe(302);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('location')).toContain('token=');
    const resolve = (src: string, cookie: string) =>
      app.handle(
        new Request('http://localhost/catalog/resolve-editor-image', {
          method: 'POST',
          headers: { cookie, 'content-type': 'application/json' },
          body: JSON.stringify({ src }),
        }),
      );
    const old = '/files/' + encodeURIComponent(key) + '?exp=1&token=expired';
    const restored = await resolve(old, cookies[0]!);
    expect(restored.status).toBe(200);
    expect(await restored.json()).toEqual({ url: '/api/catalog/editor-image/' + slug });
    expect((await resolve(old, cookies[1]!)).status).toBe(404);
    expect(
      (await resolve('https://evil.invalid/files/' + key + '?exp=1&token=x', cookies[0]!)).status,
    ).toBe(404);
    await db.delete(licenses).where(eq(licenses.assetId, assetId));
    expect((await request(cookies[0])).status).toBe(403);
    expect((await resolve(old, cookies[0]!)).status).toBe(404);
  } finally {
    if (assetId) {
      await db.delete(licenses).where(eq(licenses.assetId, assetId));
      await db.delete(assets).where(eq(assets.id, assetId));
    }
    for (const id of createdUsers) await db.delete(users).where(eq(users.id, id));
  }
});
