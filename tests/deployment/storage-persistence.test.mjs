import { Buffer } from 'node:buffer';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { test } from 'node:test';

if (process.env.NESOMN_DISPOSABLE_TESTS !== '1')
  throw new Error('Requires isolated phase3 Docker lab');
test('uploaded bytes survive app recreation on the same external storage volume', async () => {
  // Run gateway acceptance first, recreate app (not volume), then run this check.
  const probe = JSON.parse(readFileSync('.cache/revision-phase-3/storage-probe.json', 'utf8'));
  assert.ok(probe.previewUrl.startsWith('/files/'));
  const response = await fetch('http://127.0.0.1:18080' + probe.previewUrl, {
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(response.status, 200);
  assert.equal(Buffer.from(await response.arrayBuffer()).toString('base64'), probe.expectedBase64);
});
