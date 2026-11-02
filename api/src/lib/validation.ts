import { z } from 'zod';
import { validateStorageKey } from './storage/key.ts';
export const moneyString = z
  .union([z.string(), z.number()])
  .transform(String)
  .refine(
    (value) => /^\d{1,10}(\.\d{1,2})?$/.test(value),
    'Harga harus nonnegative, maksimal dua desimal.',
  );
export const storageKeySchema = z.string().refine((value) => {
  try {
    validateStorageKey(value);
    return true;
  } catch {
    return false;
  }
}, 'Storage key tidak valid.');
export const publicMediaUrl = z
  .string()
  .max(2048)
  .refine((value) => {
    if (
      value.startsWith('/') &&
      !value.startsWith('//') &&
      !value.includes('\\') &&
      !value.includes('\0')
    )
      return true;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password;
    } catch {
      return false;
    }
  }, 'URL media harus HTTPS atau path lokal.');

/** Zod4 defaults apply inside optional fields. PATCH may only write keys actually sent. */
export function parsePatch<T extends Record<string, unknown>>(
  schema: { partial: () => { parse: (body: unknown) => T } },
  body: unknown,
): T {
  const parsed = schema.partial().parse(body);
  return Object.fromEntries(
    Object.entries(parsed).filter(([key]) => Object.hasOwn(body as object, key)),
  ) as T;
}
