import { describe, expect, it } from 'bun:test';
import { hashPassword, verifyPassword } from './password.ts';

describe('password', () => {
  it('menghasilkan hash yang berbeda dari plaintext', async () => {
    const hash = await hashPassword('secret123');
    expect(hash).not.toBe('secret123');
    expect(hash.length).toBeGreaterThan(0);
  });

  it('memverifikasi password yang benar', async () => {
    const hash = await hashPassword('secret123');
    expect(await verifyPassword('secret123', hash)).toBe(true);
  });

  it('menolak password yang salah', async () => {
    const hash = await hashPassword('secret123');
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });
});
