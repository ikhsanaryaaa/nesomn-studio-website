import './disposable.ts';
import { test, expect } from 'bun:test';
import { eq } from '../../api/node_modules/drizzle-orm';
import { app } from '../../api/src/index';
import { db } from '../../api/src/db/client';
import { users } from '../../api/src/db/schema';
import { createSession } from '../../api/src/modules/session/service';
import { signToken } from '../../api/src/lib/jwt';

test('supported admin CRUD stays role guarded, domains separated and provider secrets masked', async () => {
  const cleanup: Array<[string, string]> = [];
  const accounts = await db
    .insert(users)
    .values([
      { email: crypto.randomUUID() + '@test.invalid', name: 'Sample admin', role: 'admin' },
      { email: crypto.randomUUID() + '@test.invalid', name: 'Sample regular' },
    ])
    .returning();
  const cookies = await Promise.all(
    accounts.map(
      async (user) =>
        'nesomn_session=' +
        (await signToken({
          sub: user.id,
          role: user.role,
          sessionId: await createSession(user.id, null, null),
        })),
    ),
  );
  async function call(resource: string, method = 'GET', body?: unknown, cookie = cookies[0]) {
    return app.handle(
      new Request('http://localhost/admin/' + resource, {
        method,
        headers: { cookie: cookie!, 'content-type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
    );
  }
  const suffix = crypto.randomUUID();
  const entries: Array<[string, Record<string, unknown>, Record<string, unknown>]> = [
    [
      'plans',
      {
        code: 'sample-' + suffix,
        name: 'Sample plan',
        segment: 'individual',
        cycle: 'monthly',
        editorAccess: { scene2d: true, editor3d: false, proTemplates: false, aiVideo: false },
      },
      { name: 'Updated sample plan' },
    ],
    [
      'credit-packs',
      {
        code: 'sample-' + suffix,
        name: 'Sample credits',
        credits: 10,
        priceIdr: '100',
        priceUsd: '1',
      },
      { credits: 11 },
    ],
    [
      'assets-scene',
      { slug: 'sample-scene-' + suffix, title: 'Sample scene', type: 'graphic', status: 'draft' },
      { title: 'Updated scene' },
    ],
    [
      'assets-3d',
      { slug: 'sample-3d-' + suffix, title: 'Sample 3D', type: 'asset3d', status: 'draft' },
      { title: 'Updated 3D' },
    ],
    [
      'bundles',
      { slug: 'sample-bundle-' + suffix, title: 'Sample bundle' },
      { title: 'Updated bundle' },
    ],
    [
      'ai-providers',
      {
        key: 'sample-' + suffix,
        kind: 'image',
        tab: 'scene',
        modelName: 'Sample model',
        enabled: false,
        apiKey: 'synthetic-provider-key-never-real',
      },
      { apiKey: '', creditCost: 7 },
    ],
  ];
  try {
    for (const [resource, body, patch] of entries) {
      expect((await call(resource, 'POST', body, cookies[1])).status).toBe(403);
      const response = await call(resource, 'POST', body);
      expect(response.status).toBe(201);
      const row = await response.json();
      cleanup.push([resource, row.id]);
      const listed = await call(resource);
      expect(listed.status).toBe(200);
      expect(Number(listed.headers.get('x-total-count'))).toBeGreaterThan(0);
      const updated = await call(resource + '/' + row.id, 'PATCH', patch);
      expect(updated.status).toBe(200);
      const value = await updated.json();
      for (const [key, previous] of Object.entries(row))
        if (!['updatedAt', 'searchVector'].includes(key) && !(key in patch))
          expect(value[key]).toEqual(previous);
      if (resource === 'ai-providers') {
        expect(value.hasApiKey).toBe(true);
        expect(JSON.stringify(value)).not.toContain('synthetic-provider-key');
        expect(value.apiKeyEncrypted).toBeUndefined();
        expect(value.creditCost).toBe(7);
      } else for (const [key, v] of Object.entries(patch)) expect(value[key]).toEqual(v);
      if (resource === 'assets-scene') expect((await call('assets-3d/' + row.id)).status).toBe(404);
      if (resource === 'assets-3d') expect((await call('assets-scene/' + row.id)).status).toBe(404);
      expect((await call(resource + '/' + row.id, 'DELETE', undefined, cookies[1])).status).toBe(
        403,
      );
      expect((await call(resource + '/' + row.id, 'DELETE')).status).toBe(200);
      expect((await call(resource + '/' + row.id)).status).toBe(404);
    }
    for (const resource of [
      'users',
      'sessions',
      'audit-logs',
      'subscriptions',
      'credit-ledger',
      'bundle-assets',
    ]) {
      expect((await call(resource)).status).toBe(200);
      expect((await call(resource, 'GET', undefined, cookies[1])).status).toBe(403);
    }
    expect(
      (await call('assets-scene', 'POST', { slug: 'bad', title: 'Bad', type: 'asset3d' })).status,
    ).toBe(422);
    expect(
      (
        await call('credit-packs', 'POST', {
          code: 'bad',
          name: 'Bad',
          credits: -1,
          priceIdr: '1',
          priceUsd: '1',
        })
      ).status,
    ).toBe(422);
  } finally {
    for (const [resource, id] of cleanup.reverse()) await call(resource + '/' + id, 'DELETE');
    for (const user of accounts) await db.delete(users).where(eq(users.id, user.id));
  }
});
