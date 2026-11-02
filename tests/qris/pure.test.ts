import { test, expect } from 'bun:test';
import {
  crc16,
  encodeQr,
  parseQr,
  chooseAmount,
  verifyReceiptSignature,
  signReceipt,
} from '../../api/src/modules/billing/qris/pure.ts';
const qr = () => {
  const text = '00020101021126100006SAMPLE5204000053033605802ID5904DEMO6004TEST6304';
  return text + crc16(text);
};
test('QRIS amount is server encoded and CRC/tags/currency verified', () => {
  const payload = encodeQr(qr(), 10101);
  expect(parseQr(payload).get('54')).toBe('10101');
  expect(parseQr(payload).get('01')).toBe('12');
  expect(() => encodeQr(qr().slice(0, -1) + (qr().endsWith('0') ? '1' : '0'), 100)).toThrow();
  expect(() => encodeQr(qr(), -1)).toThrow();
});
test('unique amount considers every historic payable including cross-base collisions; exhaustion rejects', () => {
  expect(chooseAmount(100, new Set([101, 102]))).toEqual({ code: 3, payable: 103 });
  expect(() =>
    chooseAmount(100, new Set(Array.from({ length: 999 }, (_, i) => 101 + i))),
  ).toThrow();
});
test('receipt signature binds raw body, timestamp and key; old/tampered receipt rejects', () => {
  const key = 'synthetic-qris-receipt-key-32-characters-only';
  const body = '{"sample":true}',
    now = 1700000000;
  const signature = signReceipt(body, now, key);
  expect(verifyReceiptSignature(body, String(now), signature, key, now)).toBe(true);
  expect(verifyReceiptSignature(body + ' ', String(now), signature, key, now)).toBe(false);
  expect(verifyReceiptSignature(body, String(now), signature, key, now + 301)).toBe(false);
  expect(verifyReceiptSignature(body, String(now), signature, '', now)).toBe(false);
});

test('stream reader rejects oversize payload before authentication/parsing', async () => {
  const { readReceiptBody } = await import('../../api/src/modules/billing/qris/pure.ts');
  await expect(
    readReceiptBody(new Request('http://localhost', { method: 'POST', body: 'x'.repeat(16385) })),
  ).rejects.toThrow();
  expect(
    await readReceiptBody(new Request('http://localhost', { method: 'POST', body: '{}' })),
  ).toBe('{}');
});
