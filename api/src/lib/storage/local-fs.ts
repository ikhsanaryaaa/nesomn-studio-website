import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, writeFile, unlink, lstat, realpath, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { StorageDriver } from './index.ts';
import { validateStorageKey } from './key.ts';

/**
 * Driver storage lokal untuk dev: simpan file ke api/.storage/.
 * Signed URL berupa /files/:key + token HMAC ber-TTL (tanpa server eksternal).
 */
export type LocalFsDriver = StorageDriver;

const ROOT = path.resolve(process.env.STORAGE_PATH ?? path.join(process.cwd(), '.storage'));

/** Kunci HMAC dari env; reuse ENCRYPTION_KEY agar tidak menambah secret. */
function hmacKey(): string {
  if (!process.env.ENCRYPTION_KEY)
    throw new Error('ENCRYPTION_KEY is required for signed storage.');
  return process.env.ENCRYPTION_KEY;
}

/** Tanda tangani key+expiry untuk mencegah akses tanpa izin. */
export function signToken(key: string, expiresAt: number): string {
  validateStorageKey(key);
  return createHmac('sha256', hmacKey()).update(`${key}:${expiresAt}`).digest('hex');
}

/** Verifikasi token download (dipakai route /files/:key). */
export function verifyToken(key: string, expiresAt: number, token: string): boolean {
  if (!Number.isSafeInteger(expiresAt) || Date.now() >= expiresAt || !/^[a-f0-9]{64}$/.test(token))
    return false;
  try {
    return timingSafeEqual(
      Buffer.from(signToken(key, expiresAt), 'hex'),
      Buffer.from(token, 'hex'),
    );
  } catch {
    return false;
  }
}

/** Path absolut aman di dalam ROOT (cegah path traversal). */
function resolveSafe(key: string): string {
  const full = path.resolve(ROOT, validateStorageKey(key));
  const relative = path.relative(ROOT, full);
  if (relative.startsWith('..') || path.isAbsolute(relative))
    throw new Error('Invalid storage key.');
  return full;
}

async function assertNoSymlinks(key: string, create = false) {
  const full = resolveSafe(key);
  if (create) await mkdir(ROOT, { recursive: true });
  const root = await realpath(ROOT);
  let cursor = ROOT;
  const parts = validateStorageKey(key).split('/');
  for (let i = 0; i < parts.length; i++) {
    cursor = path.join(cursor, parts[i]!);
    let stat;
    try {
      stat = await lstat(cursor);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT' || !create) throw error;
      if (i < parts.length - 1) {
        await mkdir(cursor);
        stat = await lstat(cursor);
      } else break;
    }
    if (stat?.isSymbolicLink()) throw new Error('Storage symlinks are forbidden.');
    if (i < parts.length - 1 && !stat?.isDirectory()) throw new Error('Invalid storage directory.');
  }
  const parent = await realpath(path.dirname(full));
  const relative = path.relative(root, parent);
  if (relative.startsWith('..') || path.isAbsolute(relative))
    throw new Error('Storage escaped root.');
  return full;
}
export async function readLocalKey(key: string) {
  return readFile(await assertNoSymlinks(key));
}

export function createLocalFsDriver(): LocalFsDriver {
  return {
    async put(key, bytes) {
      const full = await assertNoSymlinks(key, true);
      await writeFile(full, bytes);
      return key;
    },
    async getSignedUrl(key, ttlSeconds = 300) {
      validateStorageKey(key);
      if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > 3600)
        throw new Error('Invalid storage TTL.');
      const expiresAt = Date.now() + ttlSeconds * 1000;
      const token = signToken(key, expiresAt);
      const params = new URLSearchParams({ exp: String(expiresAt), token });
      return `/files/${encodeURIComponent(key)}?${params.toString()}`;
    },
    async delete(key) {
      try {
        await unlink(await assertNoSymlinks(key));
      } catch {
        // file mungkin sudah tidak ada; abaikan.
      }
    },
  };
}

/** Path root storage lokal (dipakai route streaming). */
export function localStorageRoot(): string {
  return ROOT;
}

export { resolveSafe as resolveLocalKey };
