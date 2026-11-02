import './disposable.ts';
import { test, expect } from 'bun:test';
import { eq } from '../../api/node_modules/drizzle-orm';
import { db } from '../../api/src/db/client';
import { users, assets, bundles } from '../../api/src/db/schema';
import { app } from '../../api/src/index';
import { createSession } from '../../api/src/modules/session/service';
import { signToken } from '../../api/src/lib/jwt';

test('bundle metadata/membership commit together, invalid replacement preserves data and concurrent sets never merge', async () => {
  const [user] = await db
    .insert(users)
    .values({ email: crypto.randomUUID() + '@test.invalid', name: 'Sample admin', role: 'admin' })
    .returning();
  const cookie =
    'nesomn_session=' +
    (await signToken({
      sub: user!.id,
      role: 'admin',
      sessionId: await createSession(user!.id, null, null),
    }));
  const rows = await db
    .insert(assets)
    .values([
      {
        slug: crypto.randomUUID(),
        title: 'Sample 2D',
        type: 'graphic',
        editorType: 'scene_editor',
      },
      {
        slug: crypto.randomUUID(),
        title: 'Sample 3D',
        type: 'asset3d',
        editorType: 'product_3d_editor',
      },
    ])
    .returning();
  let id: string | undefined;
  const call = (path: string, method = 'GET', body?: unknown) =>
    app.handle(
      new Request('http://localhost/admin/' + path, {
        method,
        headers: { cookie, 'content-type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
    );
  try {
    const response = await call('bundles', 'POST', {
      slug: crypto.randomUUID(),
      title: 'Sample bundle',
      type: 'custom',
      assetIds: [rows[0]!.id, rows[0]!.id],
    });
    expect(response.status).toBe(201);
    id = (await response.json()).id;
    const read = async () => await (await call('bundles/' + id)).json();
    expect((await read()).assetIds).toEqual([rows[0]!.id]);
    expect(
      (
        await call('bundles/' + id, 'PATCH', {
          title: 'Must rollback',
          assetIds: [crypto.randomUUID()],
        })
      ).status,
    ).toBe(422);
    expect((await read()).title).toBe('Sample bundle');
    expect((await read()).assetIds).toEqual([rows[0]!.id]);
    expect((await read()).type).toBe('custom');
    expect(
      (await call('bundles/' + id + '/items', 'PUT', { assetIds: [crypto.randomUUID()] })).status,
    ).toBe(422);
    expect((await read()).assetIds).toEqual([rows[0]!.id]);
    const results = await Promise.all(
      rows.map((row) => call('bundles/' + id + '/items', 'PUT', { assetIds: [row.id] })),
    );
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect((await read()).assetIds).toHaveLength(1);
    const options = await call('bundle-assets?title_like=Sample&_end=200');
    expect(options.status).toBe(200);
    const choices = await options.json();
    for (const row of rows) {
      const choice = choices.find((c: { id: string }) => c.id === row.id);
      expect(choice?.editorType).toBe(row.editorType);
      expect(choice?.fileKey).toBeUndefined();
    }
    expect(
      (await call('bundles/' + crypto.randomUUID() + '/items', 'PUT', { assetIds: [] })).status,
    ).toBe(404);
  } finally {
    if (id) await db.delete(bundles).where(eq(bundles.id, id));
    for (const row of rows) await db.delete(assets).where(eq(assets.id, row.id));
    await db.delete(users).where(eq(users.id, user!.id));
  }
});
