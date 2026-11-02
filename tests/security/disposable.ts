import { beforeAll } from 'bun:test';
import { sql } from '../../api/src/db/client.ts';
const url = new URL(process.env.DATABASE_URL ?? 'http://invalid');
if (
  process.env.NESOMN_DISPOSABLE_TESTS !== '1' ||
  url.hostname !== '127.0.0.1' ||
  url.port !== '55432' ||
  url.pathname !== '/nesomn_revision_test' ||
  url.username !== 'nesomn_test'
)
  throw new Error('Security integration only accepts the fixed disposable DB.');
beforeAll(async () => {
  const [row] = await sql`SELECT current_database() db,current_user role`;
  if (row?.db !== 'nesomn_revision_test' || row.role !== 'nesomn_test')
    throw new Error('Wrong disposable DB identity');
});
