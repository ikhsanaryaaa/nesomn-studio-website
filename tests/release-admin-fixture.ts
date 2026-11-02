import { createTestInvocation } from '../scripts/test-baseline.mjs';
if (process.env.NESOMN_DISPOSABLE_TESTS !== '1') throw Error('Disposable opt-in');
Object.assign(process.env, createTestInvocation('unit', process.env).env);
const { db, sql } = await import('../api/src/db/client');
const { users } = await import('../api/src/db/schema');
const { eq } = await import('../api/node_modules/drizzle-orm');
const [action, id] = process.argv.slice(2);
try {
  if (!id || !/^[a-f0-9-]{36}$/.test(id)) throw Error('Invalid fixture user');
  const [identity] = await sql`SELECT current_database() db,current_user role`;
  if (identity?.db !== 'nesomn_revision_test' || identity.role !== 'nesomn_test')
    throw Error('Wrong test database');
  const user = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!user?.email.startsWith('release-admin-') || !user.email.endsWith('@test.invalid'))
    throw Error('Unverified fixture user');
  if (action === 'promote') await db.update(users).set({ role: 'admin' }).where(eq(users.id, id));
  else if (action === 'cleanup') await db.delete(users).where(eq(users.id, id));
  else throw Error('Invalid fixture action');
  console.log('{}');
} finally {
  await sql.end();
}
