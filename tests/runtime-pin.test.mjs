import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertPinnedRuntime } from '../scripts/check-runtime.mjs';

test('runtime exact stable yang dipin diterima', () => {
  assert.doesNotThrow(() => assertPinnedRuntime('1.4.4', '1.4.4'));
});

test('runtime lama dan prerelease ditolak', () => {
  assert.throws(() => assertPinnedRuntime('1.4.0', '1.4.4'), /Bun 1\.4\.4/);
  assert.throws(() => assertPinnedRuntime('1.4.4-canary', '1.4.4'));
});

test('Node tidak menyamar sebagai runtime Bun', () => {
  assert.throws(() => assertPinnedRuntime(undefined, '1.4.4'), /Bun/);
});
