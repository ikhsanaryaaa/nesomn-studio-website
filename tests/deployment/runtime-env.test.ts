import { describe, expect, test } from 'bun:test';
import { readRuntimeEnv } from '../../api/src/lib/runtime-env.ts';
import { redisConnection } from '../../api/src/lib/redis.ts';

const valid = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://test:test@postgres.private:5432/test',
  REDIS_URL: 'redis://redis.private:6379/2',
  JWT_SECRET: 'synthetic-test-jwt-secret-never-production',
  ENCRYPTION_KEY: 'synthetic-test-encryption-key-never-production',
  CLIENT_URL: 'https://studio.example.test',
  ADMIN_URL: 'https://studio.example.test',
  STORAGE_DRIVER: 'local',
  STORAGE_PATH: '/data/storage',
};

describe('production startup config', () => {
  test('accepts external private DNS and explicit local storage', () => {
    expect(readRuntimeEnv(valid, 'app').port).toBe(3000);
    expect(readRuntimeEnv({ ...valid, PORT: '3100' }, 'app').port).toBe(3100);
  });
  test('rejects missing secrets, malformed services and unsafe origins without logging values', () => {
    for (const patch of [
      { DATABASE_URL: '' },
      { REDIS_URL: 'https://bad.test' },
      { JWT_SECRET: 'change-me' },
      { DATABASE_URL: 'postgresql:default' },
      { DATABASE_URL: 'postgresql:///test' },
      { DATABASE_URL: 'postgresql://private:0/test' },
      { DATABASE_URL: 'postgresql://private/' },
      { ENCRYPTION_KEY: '' },
      { PORT: 'NaN' },
      { PORT: '65536' },
      { CLIENT_URL: 'https://user:secret@studio.example.test' },
      { CLIENT_URL: 'http://public.example.test' },
      { ADMIN_URL: 'https://studio.example.test/admin' },
      { CLIENT_URL: 'https://studio.example.test/' },
      { STORAGE_PATH: 'relative/storage' },
      { STORAGE_DRIVER: 'wrong' },
      { NODE_ENV: 'test' },
    ])
      expect(() => readRuntimeEnv({ ...valid, ...patch }, 'app')).toThrow();
    try {
      readRuntimeEnv({ ...valid, DATABASE_URL: 'credential-not-to-print' }, 'app');
    } catch (error) {
      expect(String(error)).not.toContain('credential-not-to-print');
    }
  });
  test('R2 credentials required only when configured; worker needs no JWT or public origin', () => {
    expect(() => readRuntimeEnv({ ...valid, STORAGE_DRIVER: 'r2' }, 'app')).toThrow(/R2/);
    expect(() =>
      readRuntimeEnv(
        {
          ...valid,
          STORAGE_DRIVER: 'r2',
          R2_ENDPOINT: 'https://r2.example.test',
          R2_BUCKET: 'test',
          R2_ACCESS_KEY_ID: 'fake-key',
          R2_SECRET_ACCESS_KEY: 'fake-secret',
        },
        'app',
      ),
    ).not.toThrow();
    expect(() =>
      readRuntimeEnv(
        { ...valid, JWT_SECRET: undefined, CLIENT_URL: undefined, ADMIN_URL: undefined },
        'worker',
      ),
    ).not.toThrow();
    expect(() =>
      readRuntimeEnv(
        {
          ...valid,
          STORAGE_DRIVER: 'r2',
          JWT_SECRET: undefined,
          CLIENT_URL: undefined,
          ADMIN_URL: undefined,
        },
        'worker',
      ),
    ).not.toThrow();
  });
  test('production app requires explicit driver and local path instead of divergent runtime defaults', () => {
    expect(() =>
      readRuntimeEnv(
        {
          ...valid,
          STORAGE_DRIVER: undefined,
          R2_ENDPOINT: 'https://r2.example.test',
          R2_BUCKET: 'test',
          R2_ACCESS_KEY_ID: 'fake-key',
          R2_SECRET_ACCESS_KEY: 'fake-secret',
        },
        'app',
      ),
    ).toThrow(/STORAGE_DRIVER/);
    expect(() => readRuntimeEnv({ ...valid, STORAGE_PATH: undefined }, 'app')).toThrow(
      /STORAGE_PATH/,
    );
  });
});

describe('Redis URL compatibility', () => {
  test('preserves auth, database index and verified TLS on API and worker', () => {
    const producer = redisConnection('rediss://merchant:p%40ss@redis.private:6380/4', 'producer');
    expect(producer).toMatchObject({
      host: 'redis.private',
      port: 6380,
      username: 'merchant',
      password: 'p@ss',
      db: 4,
      tls: { servername: 'redis.private' },
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    expect(redisConnection('redis://:p%2Fss@127.0.0.1/2', 'worker')).toMatchObject({
      password: 'p/ss',
      db: 2,
      maxRetriesPerRequest: null,
    });
    expect(redisConnection('redis://[::1]:6379', 'worker').host).toBe('::1');
  });
  test('rejects bad scheme/index/query without reflecting credentials', () => {
    for (const url of [
      'http://private',
      'redis://private/not-a-db',
      'redis://private/-1',
      'redis://private/1/2',
      'redis://private/0?tls=false',
      'redis://private:0',
    ]) {
      expect(() => redisConnection(url, 'producer')).toThrow(/REDIS_URL/);
    }
  });
});
