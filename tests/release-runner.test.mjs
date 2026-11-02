import { test } from 'node:test';
import assert from 'node:assert/strict';
import { releaseEnvironment, releaseCases } from '../scripts/release-check.mjs';

test('release checks never inherit production secrets, URLs, dotenv or Compose overrides', () => {
  const parent = {
    PATH: process.env.PATH,
    COMPOSE_FILE: 'production.yml',
    DATABASE_URL: 'postgres://production',
    REDIS_URL: 'redis://production',
    QRIS_RECEIPT_SECRET: 'real',
    GOOGLE_CLIENT_SECRET: 'real',
    BUN_ENV_FILE: 'production.env',
    NESOMN_DISPOSABLE_TESTS: '1',
  };
  const { env } = releaseEnvironment('integration', parent);
  assert.equal(new URL(env.DATABASE_URL).hostname, '127.0.0.1');
  assert.equal(new URL(env.DATABASE_URL).pathname, '/nesomn_revision_test');
  for (const key of ['COMPOSE_FILE', 'QRIS_RECEIPT_SECRET', 'GOOGLE_CLIENT_SECRET', 'BUN_ENV_FILE'])
    assert.equal(env[key], undefined);
  assert.equal(env.NESOMN_DISPOSABLE_TESTS, '1');
  assert.throws(() => releaseEnvironment('integration', {}), /DISPOSABLE/);
});
test('release suites include phase9/QRIS/viewer and cannot expand to arbitrary test files', () => {
  assert.throws(() => releaseCases('production', 'bun'), /unit or integration/);
  const unit = releaseCases('unit', 'pinned-bun');
  assert.ok(
    unit.some(([name, , args]) => name === 'scene' && args.includes('scripts/test-phase9.mjs')),
  );
  const integration = releaseCases('integration', 'pinned-bun');
  assert.deepEqual(
    integration.map(([name]) => name),
    ['baseline', 'security', 'qris', 'viewer', 'preview-upload'],
  );
  assert.ok(
    integration.every(
      ([, command, args]) => command !== 'pinned-bun' || args.includes('--no-env-file'),
    ),
  );
});

import {
  ownsContainer,
  assertPortAvailable,
  cleanupImageReferences,
} from '../scripts/release-lab.mjs';
import { createServer } from 'node:net';
test('cleanup never accepts an unrelated repository, container prefix alone or unlabelled worker', () => {
  const root = 'c:/repo/nesomn-studio-website';
  const compose = {
    Name: '/nesomn-release-test-app-1',
    Config: {
      Labels: {
        'com.docker.compose.project': 'nesomn-release-test',
        'com.docker.compose.project.working_dir': root,
      },
    },
  };
  assert.equal(ownsContainer(compose, root), true);
  assert.equal(ownsContainer(compose, 'c:/repo/nesomn-studio'), false);
  assert.equal(ownsContainer({ Name: compose.Name, Config: { Labels: {} } }, root), false);
  const worker = {
    Name: '/nesomn-release-test-ai-worker',
    Config: { Labels: { 'nesomn.release-check': 'phase10', 'nesomn.release-root': root } },
  };
  assert.equal(ownsContainer(worker, root), true);
  assert.equal(ownsContainer({ ...worker, Name: '/production-worker' }, root), false);
});
test('occupied browser/database ports block the lab rather than adopting existing services', async () => {
  const server = createServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  try {
    await assert.rejects(assertPortAvailable(port), /occupied/);
  } finally {
    await new Promise((r) => server.close(r));
  }
  await assertPortAvailable(port);
});

test('cleanup cannot remove pre-existing or foreign image tags after a blocked preflight', () => {
  const root = 'c:/repo/nesomn-studio-website';
  const manifest = {
    root,
    status: 'active',
    tags: ['nesomn-app:release-check', 'production:latest'],
  };
  assert.deepEqual([...cleanupImageReferences([], manifest, root)], ['nesomn-app:release-check']);
  assert.equal(cleanupImageReferences([], { ...manifest, status: 'complete' }, root).size, 0);
  assert.equal(cleanupImageReferences([], manifest, 'c:/another-repo').size, 0);
  assert.equal(cleanupImageReferences([], null, root).size, 0);
});

import { createBrowserDiagnostics } from './lib/browser-runtime.mjs';
test('browser diagnostics redact query credentials and omit console argument values', () => {
  const data = createBrowserDiagnostics();
  data.capture({
    method: 'Network.responseReceived',
    params: { response: { url: 'http://localhost/files/example?token=do-not-log', status: 403 } },
  });
  data.capture({
    method: 'Runtime.consoleAPICalled',
    params: { type: 'error', args: [{ value: 'do-not-log' }] },
  });
  assert.equal(data.httpErrors[0].path, 'http://localhost/files/example');
  assert.equal(data.consoleErrors, 1);
  assert.ok(!JSON.stringify(data).includes('do-not-log'));
});
