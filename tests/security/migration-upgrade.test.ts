import './disposable.ts';
import { test, expect } from 'bun:test';
import { readFile, mkdir, writeFile, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import postgres from '../../api/node_modules/postgres';
import { drizzle } from '../../api/node_modules/drizzle-orm/postgres-js';
import { migrate } from '../../api/node_modules/drizzle-orm/postgres-js/migrator';
import { sql as admin } from '../../api/src/db/client.ts';

async function legacyDatabase() {
  const name = 'nesomn_revision_upgrade_' + crypto.randomUUID().replaceAll('-', '');
  if (!/^nesomn_revision_upgrade_[a-f0-9]{32}$/.test(name)) throw new Error('Unsafe test DB');
  await admin.unsafe(`CREATE DATABASE "${name}"`);
  const url = new URL(process.env.DATABASE_URL!);
  url.pathname = '/' + name;
  const connection = postgres(url.toString(), { max: 1 });
  const folder = resolve('.cache/revision-phase-4/migrations', name);
  await mkdir(resolve(folder, 'meta'), { recursive: true });
  const journal = JSON.parse(await readFile('api/drizzle/meta/_journal.json', 'utf8'));
  for (const entry of journal.entries)
    await copyFile(`api/drizzle/${entry.tag}.sql`, resolve(folder, entry.tag + '.sql'));
  await writeFile(
    resolve(folder, 'meta/_journal.json'),
    JSON.stringify({ ...journal, entries: journal.entries.slice(0, 4) }),
  );
  await migrate(drizzle(connection), { migrationsFolder: folder });
  return { connection, folder, journal };
}
test('upgrade preserves legacy ledger/order rows and marks historical fulfillment for review', async () => {
  const { connection: c, folder, journal } = await legacyDatabase();
  try {
    const [user] =
      await c`INSERT INTO users(email,name) VALUES('legacy-upgrade@test.invalid','Demo / Sample') RETURNING id`;
    await c`INSERT INTO credit_ledger(user_id,delta,reason,balance_after) VALUES(${user!.id},100,'topup',100)`;
    await c`INSERT INTO orders(user_id,type,status,amount_idr,gateway,gateway_ref) VALUES(${user!.id},'topup','paid',100,'pakasir','legacy-receipt')`;
    const before = await c`SELECT row_to_json(orders) data FROM orders`;
    const ledger = await c`SELECT row_to_json(credit_ledger) data FROM credit_ledger`;
    await writeFile(resolve(folder, 'meta/_journal.json'), JSON.stringify(journal));
    await migrate(drizzle(c), { migrationsFolder: folder });
    expect((await c`SELECT row_to_json(orders) data FROM orders`)[0]!.data).toEqual(
      before[0]!.data,
    );
    const after = await c`SELECT to_jsonb(credit_ledger)-'operation_key' data FROM credit_ledger`;
    expect(after[0]!.data).toEqual(ledger[0]!.data);
    expect((await c`SELECT state FROM order_fulfillments`)[0]!.state).toBe('legacy_review');
    expect((await c`SELECT count(*)::int n FROM credit_accounts`)[0]!.n).toBe(0);
    // Explicit rerun is a no-op through the real migration journal.
    await migrate(drizzle(c), { migrationsFolder: folder });
    expect((await c`SELECT count(*)::int n FROM order_fulfillments`)[0]!.n).toBe(1);
  } finally {
    await c.end();
  }
}, 15000);
test('upgrade aborts on conflicting legacy identities rather than merging/deleting them', async () => {
  const { connection: c, folder, journal } = await legacyDatabase();
  try {
    await c`INSERT INTO users(email,name) VALUES('Duplicate@test.invalid','Demo / Sample'),('duplicate@test.invalid','Demo / Sample')`;
    await writeFile(resolve(folder, 'meta/_journal.json'), JSON.stringify(journal));
    await expect(migrate(drizzle(c), { migrationsFolder: folder })).rejects.toThrow(/Reconcile/);
    expect((await c`SELECT count(*)::int n FROM users`)[0]!.n).toBe(2);
    expect(
      (
        await c`SELECT count(*)::int n FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='disabled_at'`
      )[0]!.n,
    ).toBe(0);
  } finally {
    await c.end();
  }
}, 15000);
