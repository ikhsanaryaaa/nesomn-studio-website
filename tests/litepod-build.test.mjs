import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
test('standalone worker/QRIS Dockerfiles match canonical images with repository root context', () => {
  const result = spawnSync(
    process.execPath,
    ['scripts/generate-litepod-dockerfiles.mjs', '--check'],
    { encoding: 'utf8', windowsHide: true },
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const worker = readFileSync('deploy/litepod/worker.Dockerfile', 'utf8');
  assert.match(worker, /FROM runtime AS worker/);
  assert.doesNotMatch(worker, /FROM runtime AS app/);
  assert.match(worker, /USER bun/);
  assert.match(worker, /worker\/src\/index.ts/);
  const qris = readFileSync('deploy/litepod/qris.Dockerfile', 'utf8');
  assert.match(qris, /integrations\/qris\/health_http.py/);
  assert.match(qris, /USER qris/);
});
test('Litepod runtime templates do not enable demos or merchant payments', () => {
  const app = readFileSync('deploy/litepod/app.env.example', 'utf8');
  assert.match(app, /PORT=3000/);
  assert.match(app, /TRUST_PROXY=0/);
  assert.match(app, /QRIS_ENABLED=false/);
  assert.doesNotMatch(app, /^VITE_/m);
  assert.match(
    readFileSync('deploy/litepod/worker.env.example', 'utf8'),
    /WORKER_HEALTH_PORT=3001/,
  );
});
