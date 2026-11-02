import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import process from 'node:process';
import { test } from 'node:test';
import { createTestInvocation } from '../../scripts/test-baseline.mjs';
if (process.env.NESOMN_DISPOSABLE_TESTS !== '1')
  throw new Error('Disposable phase4 Docker lab only');
const worker = 'nesomn-revision-ai-worker-phase4',
  redis = 'nesomn-revision-redis-private',
  base = 'http://127.0.0.1:18080';
const { env } = createTestInvocation('unit', process.env);
const docker = (...args) =>
  execFileSync('docker', args, { env, encoding: 'utf8', windowsHide: true }).trim();
function fixture(action, id) {
  const r = spawnSync(
    'bun',
    ['--no-env-file', '--no-install', 'tests/deployment/data-fixture.ts', action, id],
    { env: { ...env, NESOMN_DISPOSABLE_TESTS: '1' }, encoding: 'utf8', windowsHide: true },
  );
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}
test(
  'real Redis outage retains committed debit/job/outbox and worker resumes after recovery',
  { timeout: 60000 },
  async () => {
    assert.equal(
      docker('inspect', worker, '--format', '{{index .Config.Labels "nesomn.revision-test"}}'),
      'phase4',
    );
    assert.equal(
      docker('inspect', redis, '--format', '{{index .Config.Labels "nesomn.revision-test"}}'),
      'phase3',
    );
    let id;
    try {
      const response = await fetch(base + '/api/auth/register', {
        method: 'POST',
        headers: { origin: base, 'content-type': 'application/json' },
        body: JSON.stringify({
          email: `revision-phase3-${randomUUID()}@deployment.invalid`,
          password: 'Synthetic-disposable-password-only',
          name: 'Demo / Sample outage',
        }),
      });
      assert.equal(response.status, 201);
      id = (await response.json()).id;
      const cookie = response.headers.get('set-cookie').split(';')[0];
      fixture('prepare-ai', id);
      docker('stop', '--timeout', '5', redis);
      fixture('enqueue-sample', id); // Calls real API service in explicit test fixture mode, no production bypass.
      docker('start', worker);
      let state;
      for (let i = 0; i < 40; i++) {
        state = fixture('job-state', id);
        if (state.attempts >= 1) break;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      assert.equal(state.status, 'pending');
      assert.ok(state.attempts >= 1);
      assert.equal(state.deliveredAt, null);
      assert.ok(state.error);
      const unavailable = await fetch(base + '/health/ready');
      assert.equal(unavailable.status, 503);
      const balance = await (await fetch(base + '/api/ai/credit', { headers: { cookie } })).json();
      assert.equal(balance.balance, 90);
      docker('stop', '--timeout', '10', worker);
      assert.equal(docker('inspect', worker, '--format', '{{.State.ExitCode}}'), '0');
      docker('start', redis);
      docker('start', worker);
      for (let i = 0; i < 60; i++) {
        state = fixture('job-state', id);
        if (state.status === 'done') break;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      assert.equal(state.status, 'done');
      assert.ok(state.deliveredAt);
      assert.equal(
        (await (await fetch(base + '/api/ai/credit', { headers: { cookie } })).json()).balance,
        90,
      );
      writeFileSync(
        '.cache/revision-phase-4/outbox-outage-evidence.json',
        JSON.stringify(
          {
            duringOutage: { status: 'pending', balance: 90, readiness: 503, workerShutdownExit: 0 },
            afterRecovery: { status: 'done', balance: 90, delivered: true },
          },
          null,
          2,
        ),
      );
    } finally {
      docker('stop', '--timeout', '30', worker);
      docker('start', redis);
      if (id) fixture('cleanup', id);
    }
  },
);
