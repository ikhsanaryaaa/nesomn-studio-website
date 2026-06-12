import { describe, expect, it, beforeAll } from 'bun:test';
import { encryptSecret, decryptSecret } from './crypto.ts';

describe('crypto', () => {
  beforeAll(() => {
    process.env.ENCRYPTION_KEY = 'test-encryption-key-32-bytes-long!!';
  });

  it('mengembalikan nilai asli setelah encrypt lalu decrypt', () => {
    const secret = 'sk-provider-api-key-12345';
    const encrypted = encryptSecret(secret);
    expect(encrypted).not.toBe(secret);
    expect(decryptSecret(encrypted)).toBe(secret);
  });

  it('menghasilkan ciphertext berbeda untuk input sama (IV acak)', () => {
    const a = encryptSecret('same-value');
    const b = encryptSecret('same-value');
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe('same-value');
    expect(decryptSecret(b)).toBe('same-value');
  });
});
