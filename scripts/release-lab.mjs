import { createServer } from 'node:net';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { releaseEnvironment, runReleaseChecks } from './release-check.mjs';

const project = 'nesomn-release-test';
const network = project + '-data',
  storage = project + '-storage';
const tags = [
  'nesomn-app:release-check',
  'nesomn-ai-worker:release-check',
  'nesomn-qris-worker:release-check',
];
const root = resolve('.').replaceAll('\\', '/').toLowerCase();
const folder = '.cache/revision-phase-10/lab';
const evidence = 'docs/revision/artifacts/phase-10';
export function ownsContainer(c, repo = root) {
  const labels = c.Config?.Labels ?? {};
  const directory = labels['com.docker.compose.project.working_dir']
    ?.replaceAll('\\', '/')
    .toLowerCase();
  const group = labels['com.docker.compose.project'];
  return (
    (group === project && directory === repo) ||
    (group === 'nesomn-revision-test' && directory === repo + '/tests') ||
    (labels['nesomn.release-check'] === 'phase10' &&
      labels['nesomn.release-root'] === repo &&
      /^\/nesomn-release-test-(?:redis|ai-worker|qris-offline)$/.test(c.Name))
  );
}
function raw(args, env, options = {}) {
  return spawnSync('docker', args, {
    env,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 240000,
    maxBuffer: 16 * 1024 * 1024,
    ...options,
  });
}
function containers(env) {
  const ids = raw(['ps', '-aq'], env);
  if (ids.status !== 0) throw Error('Docker daemon unavailable');
  const names = ids.stdout.trim().split(/\s+/).filter(Boolean);
  return names.length ? JSON.parse(raw(['inspect', ...names], env).stdout) : [];
}
export function cleanupImageReferences(owned, manifest, repo = root) {
  return new Set([
    ...(manifest?.root === repo && manifest?.status === 'active'
      ? manifest.tags.filter((tag) => tags.includes(tag))
      : []),
    ...owned.map((c) => c.Config.Image),
  ]);
}
export function cleanupLab(env) {
  const owned = containers(env).filter((c) => ownsContainer(c));
  const removed = [];
  for (const c of owned) {
    const r = raw(['rm', '-f', c.Id], env);
    removed.push({ name: c.Name, id: c.Id, exit: r.status });
  }
  const remaining = containers(env),
    images = [];
  const manifestPath = folder + '/ownership.json';
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath)) : null;
  const references = cleanupImageReferences(owned, manifest);
  for (const reference of references) {
    const check = raw(['image', 'inspect', reference], env);
    if (check.status !== 0) continue;
    const image = JSON.parse(check.stdout)[0];
    if (remaining.some((c) => c.Image === image.Id)) {
      images.push({ reference, status: 'SKIPPED', reason: 'Used by another container' });
      continue;
    }
    const r = raw(['image', 'rm', reference], env);
    images.push({
      reference,
      status: r.status === 0 ? 'PASS' : 'FAIL',
      output: r.stdout + r.stderr,
    });
  }
  const result = {
    time: new Date().toISOString(),
    removed,
    images,
    remainingOwned: containers(env)
      .filter((c) => ownsContainer(c))
      .map((c) => c.Name),
    volumesRemoved: false,
    networksRemoved: false,
    globalPrune: false,
  };
  mkdirSync(evidence, { recursive: true });
  const output = evidence + '/docker-cleanup.json';
  if (existsSync(output)) {
    const previous = JSON.parse(readFileSync(output));
    result.history = [
      ...(previous.history ?? []),
      { time: previous.time, removed: previous.removed, images: previous.images },
    ];
  }
  writeFileSync(output, JSON.stringify(result, null, 2));
  if (
    manifest?.root === root &&
    !result.remainingOwned.length &&
    !removed.some((c) => c.exit !== 0) &&
    !images.some((i) => i.status === 'FAIL')
  )
    writeFileSync(
      manifestPath,
      JSON.stringify({ ...manifest, status: 'complete', tags: [] }, null, 2),
    );
  if (
    result.remainingOwned.length ||
    removed.some((c) => c.exit !== 0) ||
    images.some((i) => i.status === 'FAIL')
  )
    throw Error('Scoped cleanup incomplete; inspect docker-cleanup.json');
  return result;
}

export async function assertPortAvailable(port) {
  await new Promise((done, reject) => {
    const server = createServer();
    server.once('error', () => reject(Error('Test port occupied: ' + port)));
    server.listen(port, '127.0.0.1', () => server.close(done));
  });
}

export async function runLab(parent = process.env) {
  const { bun, env } = releaseEnvironment('integration', parent);
  mkdirSync(folder, { recursive: true });
  mkdirSync(evidence, { recursive: true });
  const results = [];
  function step(name, command, args, options = {}) {
    const start = Date.now();
    const r = spawnSync(command, args, {
      env,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 240000,
      maxBuffer: 16 * 1024 * 1024,
      ...options,
    });
    writeFileSync(
      folder + '/' + name + '.log',
      (r.stdout ?? '') + (r.stderr ?? '') + (r.error?.message ?? ''),
    );
    results.push({
      name,
      status: r.status === 0 ? 'PASS' : 'FAIL',
      exit: r.status,
      milliseconds: Date.now() - start,
    });
    console.log(results.at(-1).status + ': ' + name);
    if (r.status !== 0)
      throw Error(name + ' failed: ' + ((r.stdout ?? '') + (r.stderr ?? '')).slice(-2500));
    return r.stdout;
  }
  // Do not adopt running test environments or overwrite existing image tags.
  if (
    containers(env).some(
      (c) =>
        c.Name.startsWith('/nesomn-release-test-') || c.Name.startsWith('/nesomn-revision-test-'),
    )
  )
    throw Error('Test namespace occupied; inspect and clean the verified lab before starting');
  for (const port of [55432, 56379, 18086, 18088, 18090, 18092, 9236, 9237, 9238, 9239, 9240, 9241])
    await assertPortAvailable(port);
  for (const tag of tags)
    if (raw(['image', 'inspect', tag], env).status === 0)
      throw Error('Test image already exists: ' + tag);
  writeFileSync(
    folder + '/ownership.json',
    JSON.stringify({ root, status: 'active', tags, time: new Date().toISOString() }, null, 2),
  );
  const config = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://nesomn_test:nesomn_test@revision-db:5432/nesomn_revision_test',
    REDIS_URL: 'redis://:synthetic-redis-password@revision-redis:6379/4',
    JWT_SECRET: 'synthetic-deployment-jwt-secret-never-production',
    ENCRYPTION_KEY: 'synthetic-deployment-encryption-secret-never-production',
    CLIENT_URL: 'http://127.0.0.1:18092',
    ADMIN_URL: 'http://127.0.0.1:18092',
    STORAGE_DRIVER: 'local',
    STORAGE_PATH: '/data/storage',
    DATA_NETWORK: network,
    STORAGE_VOLUME: storage,
    APP_IMAGE: tags[0],
    APP_ENV_FILE: folder + '/deployment.env',
    GATEWAY_BIND: '127.0.0.1',
    GATEWAY_PORT: '18092',
    STRIPE_WEBHOOK_SECRET: 'synthetic-deployment-stripe-webhook-secret',
    QRIS_ENABLED: 'true',
    QRIS_MERCHANT_ID: '99100005',
    QRIS_STORE_ID: '1',
    QRIS_STATIC_PAYLOAD: '00020101021126100006SAMPLE5204000053033605802ID5904DEMO6004TEST630446F5',
    QRIS_TEMPLATE_SHA256: 'dd2b46adba45b8f5eeb706d39d57196be1bd0e7cadd88588afffc195c56305fb',
    QRIS_EXPECTED_NAME: 'DEMO',
    QRIS_RECEIPT_SECRET: 'synthetic-qris-acceptance-secret-never-production',
  };
  const envFile = folder + '/deployment.env';
  writeFileSync(
    envFile,
    Object.entries(config)
      .map(([k, v]) => k + '=' + v)
      .join('\n') + '\n',
  );
  const compose = ['compose', '--env-file', envFile, '-p', project, '-f', 'docker-compose.yml'];
  let failure;
  try {
    const services = step('compose-services', 'docker', [...compose, 'config', '--services'])
      .trim()
      .split(/\s+/);
    if (JSON.stringify(services) !== JSON.stringify(['app', 'gateway']))
      throw Error('Main Compose must contain exactly app/gateway');
    step('test-services', 'docker', [
      'compose',
      '-p',
      'nesomn-revision-test',
      '-f',
      'tests/compose.test.yml',
      'up',
      '-d',
      '--wait',
    ]);
    step('migration', bun, ['--no-env-file', '--no-install', '--cwd', 'api', 'src/db/migrate.ts']);
    step(
      'fixture',
      'docker',
      [
        'exec',
        '-i',
        'nesomn-revision-test-test-db-1',
        'psql',
        '-v',
        'ON_ERROR_STOP=1',
        '-U',
        'nesomn_test',
        '-d',
        'nesomn_revision_test',
      ],
      { input: readFileSync('tests/fixtures/baseline-plans.sql') },
    );
    await runReleaseChecks('integration', { ...env, NESOMN_DISPOSABLE_TESTS: '1' });
    for (const [target, tag] of [
      ['app', tags[0]],
      ['worker', tags[1]],
    ])
      step('build-' + target, 'docker', ['build', '--target', target, '-t', tag, '.']);
    step('build-qris', 'docker', ['build', '-t', tags[2], 'integrations/qris']);
    const label = [
      '--label',
      'nesomn.release-check=phase10',
      '--label',
      'nesomn.release-root=' + root,
    ];
    step('qris-offline', 'docker', [
      'run',
      '--name',
      project + '-qris-offline',
      ...label,
      '--network',
      'none',
      tags[2],
      'python',
      '-m',
      'unittest',
      '-v',
      'test_worker',
    ]);
    for (const [kind, name] of [
      ['network', network],
      ['volume', storage],
    ]) {
      const existing = raw([kind, 'inspect', name], env);
      if (existing.status !== 0) step('create-' + kind, 'docker', [kind, 'create', ...label, name]);
      else {
        const item = JSON.parse(existing.stdout)[0];
        if (
          item.Labels?.['nesomn.release-root'] !== root ||
          item.Labels?.['nesomn.release-check'] !== 'phase10' ||
          (kind === 'network' && Object.keys(item.Containers ?? {}).length)
        )
          throw Error('Unverified or occupied test ' + kind);
      }
    }
    step('connect-db', 'docker', [
      'network',
      'connect',
      '--alias',
      'revision-db',
      network,
      'nesomn-revision-test-test-db-1',
    ]);
    step('private-redis', 'docker', [
      'run',
      '-d',
      '--name',
      project + '-redis',
      ...label,
      '--network',
      network,
      '--network-alias',
      'revision-redis',
      '--tmpfs',
      '/data',
      'redis:7-alpine',
      'redis-server',
      '--save',
      '',
      '--appendonly',
      'no',
      '--requirepass',
      'synthetic-redis-password',
    ]);
    step('compose-up', 'docker', [...compose, 'up', '-d', '--no-build', '--wait']);
    step('worker-up', 'docker', [
      'run',
      '-d',
      '--name',
      project + '-ai-worker',
      ...label,
      '--network',
      network,
      '--env-file',
      envFile,
      '--read-only',
      '--tmpfs',
      '/tmp',
      '--tmpfs',
      '/data/storage:uid=1000,gid=1000',
      '--cap-drop',
      'ALL',
      '--security-opt',
      'no-new-privileges:true',
      tags[1],
    ]);
    const hygieneCode = `import {existsSync,readdirSync,statSync} from 'node:fs';
const forbidden=[];function walk(dir){for(const name of readdirSync(dir)){if(name==='node_modules')continue;const path=dir+'/'+name;if(name==='.env'||name.startsWith('.env.'))forbidden.push(path);if(statSync(path).isDirectory())walk(path);}}walk('/app');
const tooling=['vite','eslint'].filter(name=>existsSync('/app/node_modules/'+name));
const version=name=>{const path=['/app/api/node_modules/','/app/node_modules/'].map(base=>base+name+'/package.json').find(existsSync);if(!path)throw Error('Missing '+name);return JSON.parse(require('fs').readFileSync(path)).version;};
const result={bun:Bun.version,uid:process.getuid(),elysia:version('elysia'),cors:version('@elysiajs/cors'),drizzle:version('drizzle-orm'),sharp:version('sharp'),zod:version('zod'),envFiles:forbidden,developmentTooling:tooling};
if(result.uid===0||forbidden.length||tooling.length||result.bun!=='1.4.4'||result.elysia!=='1.4.30'||result.cors!=='1.4.2'||result.drizzle!=='0.45.4'||result.sharp!=='0.35.5'||result.zod!=='4.6.7')throw Error('Image hygiene rejected');console.log(JSON.stringify(result));`;
    const hygiene = JSON.parse(
      step('image-hygiene', 'docker', [
        'exec',
        project + '-app-1',
        'bun',
        '--no-env-file',
        '--eval',
        hygieneCode,
      ]),
    );
    const client = resolve('.cache/revision-phase-10/client-production'),
      admin = resolve('.cache/revision-phase-10/admin-production');
    mkdirSync(client, { recursive: true });
    mkdirSync(admin, { recursive: true });
    step('client-assets', 'docker', ['cp', project + '-app-1:/app/client/dist/.', client]);
    step('admin-assets', 'docker', ['cp', project + '-app-1:/app/admin/dist/.', admin]);
    const browserEnv = {
      ...env,
      NESOMN_DISPOSABLE_TESTS: '1',
      NESOMN_RELEASE_LAB: '1',
      NESOMN_ARTIFACT_ROOT: evidence + '/browser-' + Date.now(),
      NESOMN_CLIENT_DIST: client,
      NESOMN_VIEWER_DIST: client,
      NESOMN_UI_DIST: client,
      NESOMN_ADMIN_DIST: admin,
    };
    step('linux-bootstrap', 'node', ['--test', 'tests/browser-bootstrap.test.mjs'], {
      env: browserEnv,
    });
    for (const test of [
      'theme',
      'public',
      'editor-gateway',
      'editor-admin',
      'admin',
      'domains-ui',
      'works-public',
      'studio-kit-viewer',
      'viewer',
    ])
      step('browser-' + test, 'node', ['tests/' + test + '-browser.mjs'], { env: browserEnv });
    const http = [];
    for (const [path, status, type] of [
      ['/health/live', 200, 'json'],
      ['/health/ready', 200, 'json'],
      ['/api/catalog/assets', 200, 'json'],
      ['/api/no-such-route', 404, 'json'],
      ['/admin/credit-ledger', 200, 'html'],
      ['/admin/subscriptions', 200, 'html'],
      ['/editor/3d', 200, 'html'],
      ['/editor/scene', 200, 'html'],
      ['/assets/missing.js', 404, 'plain'],
      ['/admin/assets/missing.js', 404, 'plain'],
    ]) {
      const response = await fetch('http://127.0.0.1:18092' + path);
      const row = { path, status: response.status, type: response.headers.get('content-type') };
      http.push(row);
      if (row.status !== status || !row.type?.includes(type)) throw Error('Gateway failed ' + path);
    }
    step('worker-health', 'docker', [
      'exec',
      project + '-ai-worker',
      'bun',
      '--no-env-file',
      '--no-install',
      'api/src/healthcheck.ts',
      'worker',
    ]);
    const tested = containers(env).filter((c) => ownsContainer(c));
    writeFileSync(
      evidence + '/gateway.json',
      JSON.stringify(
        {
          http,
          hygiene,
          images: tested.map((c) => ({ name: c.Name, image: c.Image, reference: c.Config.Image })),
          liveMerchant: false,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    failure = error;
    console.error(error.message);
  } finally {
    try {
      cleanupLab(env);
      console.log('PASS: scoped Docker cleanup');
    } catch (error) {
      failure ??= error;
    }
    writeFileSync(evidence + '/lab-results.json', JSON.stringify(results, null, 2));
    writeFileSync(
      evidence + '/lab-summary.json',
      JSON.stringify(
        {
          status: failure ? 'FAIL' : 'PASS',
          error: failure?.message ?? null,
          productionReady: false,
        },
        null,
        2,
      ),
    );
  }
  if (failure) throw failure;
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const mode = process.argv[2] ?? 'run';
  if (process.argv.length > 3 || !['run', 'cleanup'].includes(mode))
    throw Error('Use run or cleanup');
  if (mode === 'cleanup') {
    const { env } = releaseEnvironment('integration', process.env);
    cleanupLab(env);
  } else await runLab();
}
