import './disposable.ts';
import { test, expect, afterAll } from 'bun:test';
import { eq } from '../../api/node_modules/drizzle-orm';
import { app } from '../../api/src/index.ts';
import { db } from '../../api/src/db/client.ts';
import {
  users,
  sessions,
  assets,
  licenses,
  subscriptions,
  plans,
} from '../../api/src/db/schema/index.ts';
import { createSession } from '../../api/src/modules/session/service.ts';
import { signToken } from '../../api/src/lib/jwt.ts';
import { getFeatureAccess } from '../../api/src/lib/feature-access.ts';
import { selectExpiredUserIds, runRetention } from '../../api/src/modules/billing/retention.ts';
if (process.env.NESOMN_DISPOSABLE_TESTS !== '1') throw new Error('Disposable only');
const ids: string[] = [],
  assetIds: string[] = [],
  planIds: string[] = [];
afterAll(async () => {
  for (const id of ids) await db.delete(users).where(eq(users.id, id));
  for (const id of assetIds) await db.delete(assets).where(eq(assets.id, id));
  for (const id of planIds) await db.delete(plans).where(eq(plans.id, id));
});
async function user() {
  const [u] = await db
    .insert(users)
    .values({ email: `sec-boundary-${crypto.randomUUID()}@test.invalid`, name: 'Demo / Sample' })
    .returning();
  ids.push(u!.id);
  return u!;
}
async function cookie(userId: string, sessionId?: string) {
  return (
    'nesomn_session=' +
    (await signToken({
      sub: userId,
      sessionId: sessionId ?? (await createSession(userId, null, null)),
      role: 'admin',
    }))
  );
}
test('expired and cross-owner sessions fail; JWT role cannot elevate; concurrent session limit holds', async () => {
  const a = await user(),
    b = await user();
  const sid = await createSession(a.id, null, null);
  const cross = await cookie(b.id, sid);
  expect(
    (await app.handle(new Request('http://localhost/me', { headers: { cookie: cross } }))).status,
  ).toBe(401);
  await db
    .update(sessions)
    .set({ expiresAt: new Date(0) })
    .where(eq(sessions.id, sid));
  expect(
    (
      await app.handle(
        new Request('http://localhost/me', { headers: { cookie: await cookie(a.id, sid) } }),
      )
    ).status,
  ).toBe(401);
  const regular = await cookie(a.id);
  expect(
    (
      await app.handle(
        new Request('http://localhost/admin/users', { headers: { cookie: regular } }),
      )
    ).status,
  ).toBe(403);
  await Promise.all(Array.from({ length: 15 }, () => createSession(b.id, null, null)));
  expect(await db.query.sessions.findMany({ where: eq(sessions.userId, b.id) })).toHaveLength(1);
});
test('draft detail and unlicensed private loader are denied; permanent license works after archival', async () => {
  const u = await user(),
    auth = await cookie(u.id);
  const [a] = await db
    .insert(assets)
    .values({
      slug: crypto.randomUUID(),
      title: 'Demo / Sample',
      type: 'asset3d',
      editorType: 'product_3d_editor',
      tier: 'pro',
      status: 'draft',
      glbFile: 'private/sample.glb',
    })
    .returning();
  assetIds.push(a!.id);
  const url = 'http://localhost/catalog/';
  expect((await app.handle(new Request(url + 'assets/' + a!.slug))).status).toBe(404);
  expect((await app.handle(new Request(url + 'editor-asset/' + a!.slug))).status).toBe(401);
  await db.update(assets).set({ status: 'published' }).where(eq(assets.id, a!.id));
  expect(
    (await app.handle(new Request(url + 'editor-asset/' + a!.slug, { headers: { cookie: auth } })))
      .status,
  ).toBe(403);
  await db.insert(licenses).values({ userId: u.id, assetId: a!.id, fileKey: a!.glbFile });
  await db.update(assets).set({ status: 'archived' }).where(eq(assets.id, a!.id));
  const allowed = await app.handle(
    new Request(url + 'editor-asset/' + a!.slug, { headers: { cookie: auth } }),
  );
  expect(allowed.status).toBe(200);
  expect((await allowed.json()).modelUrl).toContain('token=');
});
test('canceled valid period retains access and newer canceled renewal prevents retention', async () => {
  const u = await user();
  const [p] = await db
    .insert(plans)
    .values({
      code: crypto.randomUUID(),
      name: 'Demo / Sample',
      segment: 'individual',
      cycle: 'monthly',
      editorAccess: { scene2d: true, editor3d: true, proTemplates: true, aiVideo: true },
    })
    .returning();
  planIds.push(p!.id);
  await db.insert(subscriptions).values([
    {
      userId: u.id,
      planId: p!.id,
      status: 'expired',
      cycle: 'monthly',
      segment: 'individual',
      currentPeriodStart: new Date('2020-01-01'),
      currentPeriodEnd: new Date('2020-02-01'),
    },
    {
      userId: u.id,
      planId: p!.id,
      status: 'canceled',
      cycle: 'monthly',
      segment: 'individual',
      currentPeriodStart: new Date(Date.now() - 10000),
      currentPeriodEnd: new Date(Date.now() + 86400000),
    },
  ]);
  expect((await getFeatureAccess(u.id)).editor3d).toBe(true);
  expect(await selectExpiredUserIds()).not.toContain(u.id);
  expect(typeof (await runRetention())).toBe('number');
});

test('cancel targets the effective current period rather than stale active history', async () => {
  const u = await user(),
    auth = await cookie(u.id);
  const [p] = await db
    .insert(plans)
    .values({
      code: crypto.randomUUID(),
      name: 'Demo / Sample',
      segment: 'individual',
      cycle: 'monthly',
      editorAccess: { scene2d: true, editor3d: true, proTemplates: true, aiVideo: false },
    })
    .returning();
  planIds.push(p!.id);
  const [old] = await db
    .insert(subscriptions)
    .values({
      userId: u.id,
      planId: p!.id,
      status: 'active',
      cycle: 'monthly',
      segment: 'individual',
      currentPeriodStart: new Date('2020-01-01'),
      currentPeriodEnd: new Date('2020-02-01'),
    })
    .returning();
  const [current] = await db
    .insert(subscriptions)
    .values({
      userId: u.id,
      planId: p!.id,
      status: 'active',
      cycle: 'monthly',
      segment: 'individual',
      currentPeriodStart: new Date(Date.now() - 1000),
      currentPeriodEnd: new Date(Date.now() + 86400000),
    })
    .returning();
  const response = await app.handle(
    new Request('http://localhost/billing/subscription/cancel', {
      method: 'POST',
      headers: { cookie: auth },
    }),
  );
  expect(response.status).toBe(200);
  expect((await response.json()).id).toBe(current!.id);
  expect(
    (await db.query.subscriptions.findFirst({ where: eq(subscriptions.id, old!.id) }))?.status,
  ).toBe('active');
});

test('admin cannot make pending overlap effective by changing status to canceled', async () => {
  const u = await user();
  await db.update(users).set({ role: 'admin' }).where(eq(users.id, u.id));
  const auth = await cookie(u.id);
  const [p] = await db
    .insert(plans)
    .values({
      code: crypto.randomUUID(),
      name: 'Demo / Sample',
      segment: 'individual',
      cycle: 'monthly',
      editorAccess: { scene2d: true, editor3d: false, proTemplates: false, aiVideo: false },
    })
    .returning();
  planIds.push(p!.id);
  const [pending] = await db
    .insert(subscriptions)
    .values({
      userId: u.id,
      planId: p!.id,
      status: 'pending',
      cycle: 'monthly',
      segment: 'individual',
      currentPeriodStart: new Date(Date.now() - 1000),
      currentPeriodEnd: new Date(Date.now() + 60 * 86400000),
    })
    .returning();
  await db
    .insert(subscriptions)
    .values({
      userId: u.id,
      planId: p!.id,
      status: 'active',
      cycle: 'monthly',
      segment: 'individual',
      currentPeriodStart: new Date(Date.now() - 1000),
      currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
    });
  const response = await app.handle(
    new Request('http://localhost/admin/subscriptions/' + pending!.id, {
      method: 'PATCH',
      headers: { cookie: auth, 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'canceled' }),
    }),
  );
  expect(response.status).toBe(409);
  expect(
    (await db.query.subscriptions.findFirst({ where: eq(subscriptions.id, pending!.id) }))?.status,
  ).toBe('pending');
});
