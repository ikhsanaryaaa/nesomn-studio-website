import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import process from 'node:process';
import { test } from 'node:test';
import { createTestInvocation } from '../../scripts/test-baseline.mjs';

if (process.env.NESOMN_DISPOSABLE_TESTS !== '1')
  throw new Error('Requires disposable phase3 Docker lab');
const container = 'nesomn-revision-ai-worker-phase4';
const base = 'http://127.0.0.1:18080';
const { env } = createTestInvocation('unit', process.env);
const docker = (...args) =>
  execFileSync('docker', args, { env, encoding: 'utf8', windowsHide: true }).trim();
function fixture(action, id) {
  const result = spawnSync(
    'bun',
    ['--no-env-file', '--no-install', 'tests/deployment/data-fixture.ts', action, id],
    { env: { ...env, NESOMN_DISPOSABLE_TESTS: '1' }, encoding: 'utf8', windowsHide: true },
  );
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test(
  'independent explicit-test worker drains an ACTIVE sample job on SIGTERM and exits 0',
  { timeout: 30000 },
  async () => {
    assert.equal(
      docker('inspect', container, '--format', '{{index .Config.Labels "nesomn.revision-test"}}'),
      'phase4',
    );
    const networks = JSON.parse(
      docker('inspect', container, '--format', '{{json .NetworkSettings.Networks}}'),
    );
    assert.ok(networks['nesomn-revision-data-test']);
    let userId;
    try {
      const response = await fetch(base + '/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: base },
        body: JSON.stringify({
          email: `revision-phase3-${randomUUID()}@deployment.invalid`,
          password: 'Synthetic-disposable-password-only',
          name: 'Demo / Sample drain test',
        }),
      });
      assert.equal(response.status, 201);
      const cookie = response.headers.get('set-cookie').split(';')[0];
      userId = (await response.json()).id;
      fixture('prepare-ai', userId);
      const job = fixture('enqueue-sample', userId); // Explicit nonproduction fixture; production API rejects stub.
      let state;
      for (let i = 0; i < 250; i++) {
        state = await (
          await fetch(`${base}/api/ai/jobs/${job.id}`, { headers: { cookie } })
        ).json();
        if (state.status === 'processing') break;
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
      assert.equal(state.status, 'processing', 'Must observe an active job before signalling');
      docker('stop', '--timeout', '30', container);
      assert.equal(docker('inspect', container, '--format', '{{.State.ExitCode}}'), '0');
      const final = await (
        await fetch(`${base}/api/ai/jobs/${job.id}`, { headers: { cookie } })
      ).json();
      assert.equal(final.status, 'done');
      const logs = docker('logs', container);
      assert.ok(
        logs.lastIndexOf('Worker draining active jobs') < logs.lastIndexOf(`job ${job.id} selesai`),
      );
      assert.ok(logs.lastIndexOf(`job ${job.id} selesai`) < logs.lastIndexOf('Worker stopped'));
      writeFileSync(
        '.cache/revision-phase-4/worker-drain-evidence.json',
        JSON.stringify(
          {
            observedBeforeSignal: 'processing',
            final: final.status,
            exitCode: 0,
            logOrder: ['draining', 'job done', 'stopped'],
          },
          null,
          2,
        ),
      );
    } finally {
      if (userId) fixture('cleanup', userId);
    }
  },
);
