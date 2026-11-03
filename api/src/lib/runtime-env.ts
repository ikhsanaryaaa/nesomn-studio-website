import { qrisConfig } from '../modules/billing/qris/config.ts';
import { z } from 'zod';
import { isAbsolute } from 'node:path';
import { redisConnection } from './redis.ts';

const secret = z
  .string()
  .min(32)
  .refine((value) => !/^(change|replace|your[-_])/i.test(value));
const origin = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    return (
      value === url.origin &&
      !url.username &&
      !url.password &&
      url.pathname === '/' &&
      !url.search &&
      !url.hash &&
      (url.protocol === 'https:' || (local && url.protocol === 'http:'))
    );
  });
const base = z.object({
  NODE_ENV: z.literal('production'),
  DATABASE_URL: z
    .string()
    .url()
    .refine((value) => {
      const url = new URL(value);
      return (
        ['postgres:', 'postgresql:'].includes(url.protocol) &&
        !!url.hostname &&
        url.port !== '0' &&
        url.pathname.length > 1 &&
        !url.hash
      );
    }),
  REDIS_URL: z.string().min(1),
  ENCRYPTION_KEY: secret,
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  STORAGE_DRIVER: z.enum(['local', 'r2']).default('local'),
  STORAGE_PATH: z.string().min(1).refine(isAbsolute).default('/data/storage'),
});

/** Production entry validation only. Development API and isolated tests keep their own env. */
export function readRuntimeEnv(env: Record<string, string | undefined>, role: 'app' | 'worker') {
  const schema =
    role === 'app'
      ? base.extend({
          JWT_SECRET: secret,
          CLIENT_URL: origin,
          ADMIN_URL: origin,
          STORAGE_DRIVER: z.enum(['local', 'r2']),
        })
      : base;
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment: ${[...new Set(parsed.error.issues.map((issue) => issue.path.join('.')))].join(', ')}`,
    );
  }
  redisConnection(parsed.data.REDIS_URL, role === 'app' ? 'producer' : 'worker');
  if (role === 'app' && parsed.data.STORAGE_DRIVER === 'local' && !env.STORAGE_PATH) {
    throw new Error(
      'Invalid environment: STORAGE_PATH is required for local storage in production.',
    );
  }
  if (role === 'app' && parsed.data.STORAGE_DRIVER === 'r2') {
    const r2 = z
      .object({
        R2_ENDPOINT: z
          .string()
          .url()
          .refine((value) => new URL(value).protocol === 'https:'),
        R2_BUCKET: z.string().min(1),
        R2_ACCESS_KEY_ID: z.string().min(1),
        R2_SECRET_ACCESS_KEY: z.string().min(1),
      })
      .safeParse(env);
    if (!r2.success)
      throw new Error(
        'Incomplete or invalid R2 environment (R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY).',
      );
  }
  if (role === 'app' && env.QRIS_ENABLED === 'true') {
    try {
      qrisConfig(env);
    } catch {
      throw new Error('Invalid QRIS environment: check merchant/store/payload/hash/name/secret.');
    }
  }
  let domains: { landing: string; shop: string; admin: string; api: string } | undefined;
  if (role === 'app' && (env.LANDING_URL || env.API_URL)) {
    const split = z
      .object({ LANDING_URL: origin, API_URL: origin, CLIENT_URL: origin, ADMIN_URL: origin })
      .safeParse(env);
    if (!split.success || new Set(split.success ? Object.values(split.data) : []).size !== 4)
      throw new Error(
        'Invalid environment: split domains require four distinct LANDING_URL, CLIENT_URL, ADMIN_URL, API_URL origins.',
      );
    const sites = Object.values(split.data).map((value) => new URL(value));
    if (
      sites.some((site) => site.protocol !== 'https:') ||
      sites.some(
        (site) =>
          site.hostname !== new URL(split.data.LANDING_URL).hostname &&
          !site.hostname.endsWith('.' + new URL(split.data.LANDING_URL).hostname),
      )
    )
      throw new Error(
        'Invalid environment: split domains must use HTTPS on the same site for secure session cookies.',
      );
    domains = {
      landing: split.data.LANDING_URL,
      shop: split.data.CLIENT_URL,
      admin: split.data.ADMIN_URL,
      api: split.data.API_URL,
    };
  }
  return {
    domains,
    port: parsed.data.PORT,
    storageDriver: parsed.data.STORAGE_DRIVER,
    storagePath: parsed.data.STORAGE_PATH,
  };
}
