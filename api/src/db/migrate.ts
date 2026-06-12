import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

/**
 * Jalankan migration SQL dari folder `drizzle/`.
 * Memakai koneksi terpisah (max 1) yang ditutup setelah selesai.
 */
const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/nesomn';

const migrationClient = postgres(DATABASE_URL, { max: 1 });

async function main() {
  console.log('Menjalankan migration...');
  await migrate(drizzle(migrationClient), { migrationsFolder: './drizzle' });
  console.log('Migration selesai.');
  await migrationClient.end();
}

main().catch((err) => {
  console.error('Migration gagal:', err);
  process.exit(1);
});
