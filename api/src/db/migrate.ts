import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

/**
 * Jalankan migration SQL dari folder `drizzle/`.
 * Memakai koneksi terpisah (max 1) yang ditutup setelah selesai.
 */
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL required for explicit migration.');

const migrationClient = postgres(DATABASE_URL, { max: 1 });

async function main() {
  console.log('Menjalankan migration...');
  await migrate(drizzle(migrationClient), { migrationsFolder: './drizzle' });
  console.log('Migration selesai.');
  await migrationClient.end();
}

main().catch(async () => {
  console.error(
    'Migration gagal. Periksa schema/preflight di DB yang dituju; detail kredensial/SQL tidak dicetak.',
  );
  await migrationClient.end({ timeout: 5 });
  process.exit(1);
});
