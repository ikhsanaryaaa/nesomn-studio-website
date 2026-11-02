import { createHash } from 'node:crypto';
import { AppError } from '../../../middleware/error.ts';
import { parseQr } from './pure.ts';
const digest = (v: string) => createHash('sha256').update(v).digest('hex');
export function qrisConfig(env: Record<string, string | undefined> = process.env) {
  const merchant = env.QRIS_MERCHANT_ID ?? '',
    store = env.QRIS_STORE_ID ?? '',
    payload = env.QRIS_STATIC_PAYLOAD ?? '',
    secret = env.QRIS_RECEIPT_SECRET ?? '';
  if (
    env.QRIS_ENABLED !== 'true' ||
    !/^\d{1,40}$/.test(merchant) ||
    !/^\d{1,40}$/.test(store) ||
    secret.length < 32 ||
    digest(payload) !== env.QRIS_TEMPLATE_SHA256
  )
    throw new AppError('QRIS_NOT_CONFIGURED', 'QRIS belum dikonfigurasi/diaktifkan.', 503);
  const qr = parseQr(payload);
  if (qr.get('59') !== env.QRIS_EXPECTED_NAME)
    throw new AppError('QRIS_NOT_CONFIGURED', 'Identitas QRIS belum diverifikasi.', 503);
  return { merchant, store, payload, secret };
}
