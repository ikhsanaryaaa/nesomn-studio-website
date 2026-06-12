/**
 * Hashing password memakai argon2id via Bun.password (PRD §16).
 * Password plaintext tidak pernah disimpan.
 */

export async function hashPassword(plain: string): Promise<string> {
  return Bun.password.hash(plain, { algorithm: 'argon2id' });
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return Bun.password.verify(plain, hash);
}
