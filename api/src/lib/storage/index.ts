import type { LocalFsDriver } from './local-fs.ts';

/**
 * Abstraksi storage agar kode bisnis tidak terikat ke R2/S3.
 * Driver dipilih lewat env STORAGE_DRIVER:
 *   - 'local' (default): simpan ke api/.storage/, signed URL via token HMAC.
 *   - 'r2': bucket S3-compatible Cloudflare R2, presigned URL.
 *
 * Driver r2 di-load lazy supaya dev tanpa kredensial R2 tetap jalan.
 */
export interface StorageDriver {
  /** Simpan byte ke key tertentu, kembalikan key final. */
  put(key: string, bytes: Uint8Array, contentType: string): Promise<string>;
  /** URL ber-TTL untuk men-download key (signed). */
  getSignedUrl(key: string, ttlSeconds?: number): Promise<string>;
  /** Hapus objek. */
  delete(key: string): Promise<void>;
}

let cached: StorageDriver | null = null;

/** Ambil driver storage aktif (singleton). */
export async function getStorage(): Promise<StorageDriver> {
  if (cached) return cached;
  const driver = process.env.STORAGE_DRIVER ?? 'local';
  if (driver === 'r2') {
    const { createR2Driver } = await import('./r2.ts');
    cached = createR2Driver();
  } else {
    const { createLocalFsDriver } = await import('./local-fs.ts');
    cached = createLocalFsDriver() as LocalFsDriver;
  }
  return cached;
}
