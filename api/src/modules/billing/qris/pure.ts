import { createHmac, timingSafeEqual } from 'node:crypto';
export function crc16(text: string) {
  let crc = 0xffff;
  for (const byte of Buffer.from(text)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    crc &= 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
export function parseQr(payload: string) {
  if (!/^[\x20-\x7e]{40,2048}$/.test(payload) || !payload.endsWith(crc16(payload.slice(0, -4))))
    throw new Error('QR CRC/encoding invalid');
  const fields = new Map<string, string>();
  let i = 0;
  while (i < payload.length) {
    const id = payload.slice(i, i + 2),
      size = payload.slice(i + 2, i + 4);
    if (!/^\d{2}$/.test(id) || !/^\d{2}$/.test(size) || fields.has(id))
      throw new Error('Invalid QR TLV');
    const length = Number(size);
    if (!length || i + 4 + length > payload.length) throw new Error('Invalid QR length');
    fields.set(id, payload.slice(i + 4, i + 4 + length));
    i += 4 + length;
  }
  if (
    fields.get('63')?.length !== 4 ||
    payload.slice(-8, -4) !== '6304' ||
    fields.get('00') !== '01' ||
    fields.get('53') !== '360' ||
    fields.get('58') !== 'ID' ||
    !fields.get('59') ||
    !fields.get('60') ||
    ![...fields.keys()].some((id) => Number(id) >= 26 && Number(id) <= 51) ||
    ['55', '56', '57'].some((id) => fields.has(id))
  )
    throw new Error('Unsupported QRIS payload');
  return fields;
}
export function encodeQr(staticQr: string, payable: number) {
  if (!Number.isSafeInteger(payable) || payable < 1 || payable > 999999999)
    throw new Error('Invalid payable');
  const fields = parseQr(staticQr);
  fields.set('01', '12');
  fields.set('54', String(payable));
  fields.delete('63');
  const value =
    [...fields]
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([id, text]) => id + String(Buffer.byteLength(text)).padStart(2, '0') + text)
      .join('') + '6304';
  return value + crc16(value);
}
export function chooseAmount(base: number, used: Set<number>) {
  if (!Number.isSafeInteger(base) || base < 1 || base > 999998999)
    throw new Error('Invalid base price');
  for (let code = 1; code <= 999; code++)
    if (!used.has(base + code)) return { code, payable: base + code };
  throw new Error('QRIS_AMOUNT_EXHAUSTED');
}
export function signReceipt(body: string, time: number, key: string) {
  return createHmac('sha256', key).update(`nesomn-qris-v1\n${time}\n${body}`).digest('hex');
}
export function verifyReceiptSignature(
  body: string,
  time: string | null,
  signature: string | null,
  key: string,
  now = Math.floor(Date.now() / 1000),
) {
  if (
    key.length < 32 ||
    body.length > 16384 ||
    !time ||
    !/^\d{10}$/.test(time) ||
    Math.abs(now - Number(time)) > 300 ||
    !signature ||
    !/^[a-f0-9]{64}$/.test(signature)
  )
    return false;
  return timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(signReceipt(body, Number(time), key), 'hex'),
  );
}
export async function readReceiptBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 16384) {
        await reader.cancel();
        throw new Error('Receipt body too large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
}
