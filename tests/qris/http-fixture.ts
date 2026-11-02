import { createTestInvocation } from '../../scripts/test-baseline.mjs';
Object.assign(process.env, createTestInvocation('unit', process.env).env);
if (process.env.NESOMN_DISPOSABLE_TESTS !== '1') throw new Error('Disposable opt-in');
const { db, sql } = await import('../../api/src/db/client.ts');
const { users, creditPacks, qrisInvoices, qrisReceipts } =
  await import('../../api/src/db/schema/index.ts');
const { eq } = await import('../../api/node_modules/drizzle-orm');
const [action, id, packId] = process.argv.slice(2);
try {
  const [identity] = await sql`SELECT current_database() db,current_user role`;
  if (identity?.db !== 'nesomn_revision_test' || identity.role !== 'nesomn_test')
    throw new Error('Wrong DB');
  const user = await db.query.users.findFirst({ where: eq(users.id, id!) });
  if (!user?.email.startsWith('phase5-http-') || !user.email.endsWith('@test.invalid'))
    throw new Error('Not HTTP fixture');
  if (action === 'prepare') {
    const [pack] = await db
      .insert(creditPacks)
      .values({
        code: 'phase5-http-' + user.id,
        name: 'Demo / Sample',
        credits: 10,
        priceIdr: '100',
        priceUsd: '1',
      })
      .returning();
    console.log(JSON.stringify({ packId: pack!.id }));
  } else if (action === 'cleanup') {
    const invoices = await db.query.qrisInvoices.findMany({
      where: eq(qrisInvoices.userId, user.id),
    });
    for (const inv of invoices)
      await db.delete(qrisReceipts).where(eq(qrisReceipts.orderId, inv.orderId));
    await db.delete(users).where(eq(users.id, user.id));
    if (packId) await db.delete(creditPacks).where(eq(creditPacks.id, packId));
    console.log('{}');
  } else throw new Error('Invalid action');
} finally {
  await sql.end();
}
