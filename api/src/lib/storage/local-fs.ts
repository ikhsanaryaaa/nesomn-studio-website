import { createHmac } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import type { StorageDriver } from './index.ts';

/**
 * Driver storage lokal untuk dev: simpan file ke api/.storage/.
 * Signed URL berupa /files/:key + token HMAC ber-TTL (tanpa server eksternal).
 */
export type LocalFsDriver = StorageDriver;

const ROOT = path.resolve(process.cwd(), '.storage');

/** Kunci HMAC dari env; reuse ENCRYPTION_KEY agar tidak menambah secret. */
function hmacKey(): string {
  return process.env.ENCRYPTION_KEY ?? 'dev-storage-key';
}

/** Tanda tangani key+expiry untuk mencegah akses tanpa izin. */
export function signToken(key: string, expiresAt: number): string {
  return createHmac('sha256', hmacKey())
    .update(`${key}:${expiresAt}`)
    .digest('hex');
}

/** Verifikasi token download (dipakai route /files/:key). */
export function verifyToken(key: string, expiresAt: number, token: string): boolean {
  if (Date.now() > expiresAt) return false;
  const expected = signToken(key, expiresAt);
  return expected === token;
}

/** Path absolut aman di dalam ROOT (cegah path traversal). */
function resolveSafe(key: string): string {
  const full = path.resolve(ROOT, key);
  if (!full.startsWith(ROOT)) throw new Error('Invalid storage key.');
  return full;
}

export function createLocalFsDriver(): LocalFsDriver {
  return {
    async put(key, bytes) {
      const full = resolveSafe(key);
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, bytes);
      return key;
    },
    async getSignedUrl(key, ttlSeconds = 300) {
      const expiresAt = Date.now() + ttlSeconds * 1000;
      const token = signToken(key, expiresAt);
      const params = new URLSearchParams({ exp: String(expiresAt), token });
      return `/files/${encodeURIComponent(key)}?${params.toString()}`;
    },
    async delete(key) {
      try {
        await unlink(resolveSafe(key));
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
