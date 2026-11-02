import { createTestInvocation } from '../scripts/test-baseline.mjs';
Object.assign(process.env, createTestInvocation('unit', process.env).env);
if (process.env.NESOMN_DISPOSABLE_TESTS !== '1') throw Error('Disposable opt-in');
const { db, sql } = await import('../api/src/db/client.ts');
const { assets, users, qrisInvoices, qrisReceipts } = await import('../api/src/db/schema/index.ts');
const { eq } = await import('../api/node_modules/drizzle-orm');
const [action, run, userId] = process.argv.slice(2);
if (!run || !/^[a-f0-9-]{36}$/.test(run)) throw Error('Invalid run');
try {
  const [identity] = await sql`SELECT current_database() db,current_user role`;
  if (identity?.db !== 'nesomn_revision_test' || identity.role !== 'nesomn_test')
    throw Error('Wrong DB');
  const slug = 'phase7-demo-' + run;
  if (action === 'prepare') {
    const [asset] = await db
      .insert(assets)
      .values({
        slug,
        title: 'Demo / Sample — Nesomn asset',
        description: 'Synthetic disposable acceptance only. Not a product for sale.',
        type: 'graphic',
        tier: 'pro',
        isMarketplace: true,
        isSubscriptionAsset: false,
        status: 'published',
        priceIdr: '100',
        priceUsd: '1',
        previews: ['/nesomn-logo-black.svg', '/nesomn-logo-white.svg'],
        fileKey: 'assets/' + slug + '.bin',
      })
      .returning();
    console.log(JSON.stringify({ id: asset!.id, slug, fileKey: asset!.fileKey }));
  } else if (action === 'cleanup') {
    if (userId) {
      const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
      if (!user?.email.startsWith('phase7-' + run) || !user.email.endsWith('@test.invalid'))
        throw Error('Wrong user');
      const invoices = await db.query.qrisInvoices.findMany({
        where: eq(qrisInvoices.userId, userId),
      });
      for (const i of invoices)
        await db.delete(qrisReceipts).where(eq(qrisReceipts.orderId, i.orderId));
      await db.delete(users).where(eq(users.id, userId));
    }
    await db.delete(assets).where(eq(assets.slug, slug));
    console.log('{}');
  } else throw Error('Invalid action');
} finally {
  await sql.end();
}
