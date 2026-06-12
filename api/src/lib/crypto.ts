import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';

/**
 * Enkripsi simetris AES-256-GCM untuk kredensial sensitif
 * (mis. ai_providers.apiKey). Kunci dari env ENCRYPTION_KEY.
 *
 * Format keluaran (base64): iv(12) + authTag(16) + ciphertext.
 * Dipakai penuh di M3 (admin) & M7 (worker); util disiapkan di M1.
 */

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;

/** Turunkan kunci 32-byte dari env (hash agar panjang konsisten). */
function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) {
    throw new Error('ENCRYPTION_KEY belum diset di environment.');
  }
  return createHash('sha256').update(secret).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function decryptSecret(payload: string): string {
  const data = Buffer.from(payload, 'base64');
  const iv = data.subarray(0, IV_LEN);
  const authTag = data.subarray(IV_LEN, IV_LEN + 16);
  const encrypted = data.subarray(IV_LEN + 16);
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
