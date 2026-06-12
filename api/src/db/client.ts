import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.ts';

/**
 * Koneksi Postgres + instance Drizzle.
 * Koneksi dibuat saat modul ini di-import (bukan saat import schema),
 * sehingga modul schema tetap bebas side-effect.
 */
const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/nesomn';

/** Klien postgres mentah (dipakai juga untuk migrator & seed). */
export const sql = postgres(DATABASE_URL, { max: 10 });

/** Instance Drizzle dengan seluruh schema & konvensi snake_case. */
export const db = drizzle(sql, { schema, casing: 'snake_case' });

export type DB = typeof db;
