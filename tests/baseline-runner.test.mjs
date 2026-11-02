import assert from 'node:assert/strict';
import { test } from 'node:test';
import { URL } from 'node:url';
import { createTestInvocation } from '../scripts/test-baseline.mjs';

test('unit baseline hanya menjalankan file murni dan fixture tanpa DB', () => {
  const invocation = createTestInvocation('unit', {});
  assert.deepEqual(invocation.args.slice(0, 3), ['--no-env-file', '--no-install', 'test']);
  assert.equal(invocation.args.length, 8);
  assert.ok(invocation.args.includes('./api/src/modules/catalog/pricing.test.ts'));
  assert.ok(!invocation.args.includes('./api/src/modules/auth/auth.test.ts'));
  assert.ok(invocation.args.includes('./tests/scene-compatibility.test.ts'));
});

test('secret dan target production dari shell tidak diwariskan ke test', () => {
  const invocation = createTestInvocation('unit', {
    PATH: 'path-for-test',
    DATABASE_URL: 'postgresql://production.invalid/live',
    REDIS_URL: 'redis://production.invalid:6379',
    STRIPE_SECRET_KEY: 'private-value-do-not-propagate',
    SHOPEE_TOKEN: 'private-value-do-not-propagate',
    NODE_OPTIONS: '--require production-hook',
    JWT_SECRET: 'production-value',
  });
  assert.equal(invocation.env.PATH, 'path-for-test');
  assert.equal(invocation.env.STRIPE_SECRET_KEY, undefined);
  assert.equal(invocation.env.SHOPEE_TOKEN, undefined);
  assert.equal(invocation.env.NODE_OPTIONS, undefined);
  assert.notEqual(invocation.env.JWT_SECRET, 'production-value');
  const database = new URL(invocation.env.DATABASE_URL);
  assert.equal(database.hostname, '127.0.0.1');
  assert.equal(database.port, '55432');
  assert.equal(database.pathname, '/nesomn_revision_test');
  assert.equal(new URL(invocation.env.REDIS_URL).port, '56379');
});

test('integration ditolak sebelum ada deklarasi environment disposable', () => {
  assert.throws(() => createTestInvocation('integration', {}), /NESOMN_DISPOSABLE_TESTS=1/);
  assert.throws(() => createTestInvocation('integration', { NESOMN_DISPOSABLE_TESTS: 'true' }));
});

test('integration memakai delapan file eksplisit dan endpoint test tetap', () => {
  const invocation = createTestInvocation('integration', {
    NESOMN_DISPOSABLE_TESTS: '1',
    DATABASE_URL: 'postgresql://production.invalid/live',
    REDIS_URL: 'redis://production.invalid:6379',
  });
  assert.equal(invocation.args.length, 11);
  assert.ok(invocation.args.includes('./worker/src/process-job.test.ts'));
  assert.ok(invocation.args.includes('./api/src/modules/billing/retention.test.ts'));
  assert.equal(invocation.env.DATABASE_URL, 'postgresql://nesomn_test:nesomn_test@127.0.0.1:55432/nesomn_revision_test');
  assert.equal(invocation.env.REDIS_URL, 'redis://127.0.0.1:56379/0');
  assert.equal(invocation.env.PAKASIR_API_KEY, undefined);
});

test('mode yang tidak dikenal tidak dapat menjalankan command arbitrer', () => {
  assert.throws(() => createTestInvocation('production', {}), /Mode/);
});
