import { expect, test } from 'bun:test';
import { checkReadiness } from '../../api/src/lib/readiness.ts';

test('readiness bounds slow dependencies, catches failures and can recover', async () => {
  const never = () => new Promise<void>(() => {});
  const start = Date.now();
  expect(
    await checkReadiness(
      {
        database: never,
        redis: async () => {
          throw new Error('secret must not escape');
        },
      },
      30,
    ),
  ).toEqual({ database: false, redis: false });
  expect(Date.now() - start).toBeLessThan(1000);
  expect(await checkReadiness({ database: async () => {}, redis: async () => {} }, 30)).toEqual({
    database: true,
    redis: true,
  });
});
