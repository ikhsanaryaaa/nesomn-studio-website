import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const ns = 'nesomn-litepod-test',
  folder = 'docs/revision/artifacts/litepod-2026-11-02';
mkdirSync(folder, { recursive: true });
mkdirSync('.cache/litepod', { recursive: true });
const owned = [],
  images = [],
  pulled = [];
let networkCreated = false,
  failure;
const results = [];
function raw(args, options = {}) {
  return spawnSync('docker', args, {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 240000,
    maxBuffer: 8000000,
    ...options,
  });
}
function step(name, args, options = {}) {
  const r = raw(args, options);
  writeFileSync(folder + '/' + name + '.log', (r.stdout ?? '') + (r.stderr ?? ''));
  results.push({ name, status: r.status === 0 ? 'PASS' : 'FAIL', exit: r.status });
  writeFileSync(folder + '/results.json', JSON.stringify(results, null, 2));
  console.log(results.at(-1).status + ': ' + name);
  if (r.status !== 0) throw Error(name + ' failed (see log)');
  return r.stdout;
}
const all = raw(['ps', '-a', '--format', '{{.Names}}']);
if (all.status !== 0) throw Error('Docker unavailable');
if (all.stdout.split(/\s+/).some((n) => n.startsWith(ns))) throw Error('Test namespace occupied');
if (raw(['network', 'inspect', ns]).status === 0) throw Error('Test network already exists');
for (const tag of ['app', 'worker', 'qris'].map((s) => ns + ':' + s))
  if (raw(['image', 'inspect', tag]).status === 0) throw Error('Test tag already exists: ' + tag);
const envFile = resolve('.cache/litepod/runtime.env');
writeFileSync(
  envFile,
  [
    'NODE_ENV=production',
    'PORT=3000',
    'WORKER_HEALTH_PORT=3001',
    'TRUST_PROXY=0',
    'CLIENT_URL=http://localhost:3000',
    'ADMIN_URL=http://localhost:3000',
    'DATABASE_URL=postgresql://nesomn_test:synthetic-test-password@db:5432/nesomn_litepod_test',
    'REDIS_URL=redis://:synthetic-redis-password@redis:6379/0',
    'JWT_SECRET=synthetic-litepod-jwt-secret-never-production',
    'ENCRYPTION_KEY=synthetic-litepod-encryption-secret-never-production',
    'STORAGE_DRIVER=local',
    'STORAGE_PATH=/data/storage',
    'QRIS_ENABLED=false',
    'ALLOW_AI_STUB=false',
    'ALLOW_PAYMENT_STUB=false',
  ].join('\n') + '\n',
);
function run(name, args) {
  const full = ns + '-' + name;
  owned.push(full);
  return step('run-' + name, [
    'run',
    '--name',
    full,
    '--label',
    'nesomn.test=litepod-2026-11-02',
    ...args,
  ]);
}
async function waitHealth(name) {
  for (let i = 0; i < 60; i++) {
    const r = raw(['inspect', ns + '-' + name, '--format', '{{.State.Health.Status}}']);
    if (r.stdout.trim() === 'healthy') return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw Error(name + ' readiness timeout');
}
try {
  for (const [kind, file] of [
    ['app', 'Dockerfile'],
    ['worker', 'deploy/litepod/worker.Dockerfile'],
    ['qris', 'deploy/litepod/qris.Dockerfile'],
  ]) {
    images.push(ns + ':' + kind);
    step('build-' + kind, ['build', '-f', file, '-t', ns + ':' + kind, '.']);
  }
  step('network', ['network', 'create', '--label', 'nesomn.test=litepod-2026-11-02', ns]);
  networkCreated = true;
  for (const image of ['postgres:17-alpine', 'redis:7-alpine']) {
    if (raw(['image', 'inspect', image]).status !== 0) {
      pulled.push(image);
      step('pull-' + image.split(':')[0], ['pull', image]);
    }
  }
  run('db', [
    '-d',
    '--network',
    ns,
    '--network-alias',
    'db',
    '--tmpfs',
    '/var/lib/postgresql/data',
    '-e',
    'POSTGRES_USER=nesomn_test',
    '-e',
    'POSTGRES_PASSWORD=synthetic-test-password',
    '-e',
    'POSTGRES_DB=nesomn_litepod_test',
    '--health-cmd',
    'pg_isready -U nesomn_test -d nesomn_litepod_test',
    '--health-interval',
    '1s',
    'postgres:17-alpine',
  ]);
  run('redis', [
    '-d',
    '--network',
    ns,
    '--network-alias',
    'redis',
    'redis:7-alpine',
    'redis-server',
    '--save',
    '',
    '--appendonly',
    'no',
    '--requirepass',
    'synthetic-redis-password',
  ]);
  await waitHealth('db');
  run('migrate', [
    '--network',
    ns,
    '--env-file',
    envFile,
    '--workdir',
    '/app/api',
    '--entrypoint',
    'bun',
    ns + ':app',
    '--no-env-file',
    '--no-install',
    'src/db/migrate.ts',
  ]);
  run('app', [
    '-d',
    '--network',
    ns,
    '--env-file',
    envFile,
    '--publish',
    '127.0.0.1::3000',
    ns + ':app',
  ]);
  run('worker', [
    '-d',
    '--network',
    ns,
    '--env-file',
    envFile,
    '--publish',
    '127.0.0.1::3001',
    ns + ':worker',
  ]);
  await waitHealth('app');
  await waitHealth('worker');
  const port = (name) =>
    raw(['port', ns + '-' + name, name === 'app' ? '3000/tcp' : '3001/tcp'])
      .stdout.trim()
      .split(':')
      .at(-1);
  const checks = [];
  for (const [name, path, status, type] of [
    ['app', '/health/ready', 200, 'json'],
    ['app', '/api/unknown', 404, 'json'],
    ['app', '/admin/login', 200, 'html'],
    ['app', '/editor/scene', 200, 'html'],
    ['app', '/assets/missing.js', 404, null],
    ['worker', '/health/ready', 200, 'json'],
  ]) {
    const response = await fetch('http://127.0.0.1:' + port(name) + path);
    const row = { name, path, status: response.status, type: response.headers.get('content-type') };
    checks.push(row);
    if (row.status !== status || (type && !row.type?.includes(type)))
      throw Error('HTTP smoke failed: ' + path);
  }
  writeFileSync(folder + '/http.json', JSON.stringify(checks, null, 2));
  run('qris-offline', [
    '--network',
    'none',
    ns + ':qris',
    'python',
    '-m',
    'unittest',
    '-v',
    'test_worker',
  ]);
  const hygiene = [];
  for (const kind of ['app', 'worker', 'qris']) {
    const data = JSON.parse(raw(['image', 'inspect', ns + ':' + kind]).stdout)[0];
    if (!data.Config.User || data.Config.User === 'root') throw Error('Non-root contract failed');
    hygiene.push({
      kind,
      user: data.Config.User,
      cmd: data.Config.Cmd,
      health: !!data.Config.Healthcheck,
    });
  }
  writeFileSync(folder + '/image-contracts.json', JSON.stringify(hygiene, null, 2));
} catch (error) {
  failure = error;
  console.error(error.message);
} finally {
  const removed = [],
    removedImages = [];
  for (const name of owned.reverse()) {
    const check = raw(['inspect', name]);
    if (check.status !== 0) continue;
    const c = JSON.parse(check.stdout)[0];
    if (c.Config.Labels?.['nesomn.test'] !== 'litepod-2026-11-02') {
      failure ??= Error('Unowned container: ' + name);
      continue;
    }
    const r = raw(['rm', '-f', name]);
    removed.push({ name, exit: r.status });
    if (r.status !== 0) failure ??= Error('Container cleanup failed');
  }
  const rest = raw(['ps', '-aq']).stdout.trim().split(/\s+/).filter(Boolean);
  const used = rest.length ? JSON.parse(raw(['inspect', ...rest]).stdout).map((c) => c.Image) : [];
  for (const image of [...images, ...pulled]) {
    const inspect = raw(['image', 'inspect', image]);
    if (inspect.status !== 0) continue;
    const id = JSON.parse(inspect.stdout)[0].Id;
    if (used.includes(id)) {
      removedImages.push({ image, status: 'RETAINED (used by another container)' });
      continue;
    }
    const r = raw(['image', 'rm', image]);
    removedImages.push({ image, exit: r.status });
    if (r.status !== 0) failure ??= Error('Image cleanup failed');
  }
  if (networkCreated) {
    const r = raw(['network', 'rm', ns]);
    if (r.status !== 0) failure ??= Error('Network cleanup failed');
  }
  writeFileSync(
    folder + '/cleanup.json',
    JSON.stringify(
      {
        removed,
        images: removedImages,
        globalPrune: false,
        volumesDeleted: false,
        buildCachePruned: false,
      },
      null,
      2,
    ),
  );
  writeFileSync(
    folder + '/summary.json',
    JSON.stringify(
      { status: failure ? 'FAIL' : 'PASS', error: failure?.message ?? null, production: false },
      null,
      2,
    ),
  );
}
if (failure) process.exitCode = 1;
