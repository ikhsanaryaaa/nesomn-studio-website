import { defineConfig } from 'drizzle-kit';

/**
 * Konfigurasi drizzle-kit untuk generate & migrasi schema.
 * Schema ditulis manual di `src/db/schema/*`, output SQL ke `drizzle/`.
 */
export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/nesomn',
  },
  casing: 'snake_case',
});
