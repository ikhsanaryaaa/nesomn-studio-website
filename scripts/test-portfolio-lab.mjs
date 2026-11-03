import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { releaseEnvironment } = await import(pathToFileURL(resolve('scripts/release-check.mjs')));
const { bun, env } = releaseEnvironment('integration', {
  ...process.env,
  NESOMN_DISPOSABLE_TESTS: '1',
});
env.STORAGE_PATH = resolve('.cache/works-phase1/storage');
const acceptance = process.argv.includes('--acceptance');
const sampleTest = acceptance || process.argv.includes('--sample');
const folder =
  'docs/revision/artifacts/' +
  (acceptance ? 'marketing-phase5' : sampleTest ? 'works-phase2' : 'works-phase1') +
  '-2026-11-03';
mkdirSync(folder, { recursive: true });
mkdirSync('.cache/works-phase1', { recursive: true });
if (spawnSync(bun, ['--version'], { env, encoding: 'utf8' }).stdout.trim() !== '1.4.4')
  throw Error('Bun1.4.4 required');
const results = [],
  project = 'nesomn-revision-test',
  tag = 'nesomn-app:works-phase1-' + Date.now(),
  name = 'nesomn-works-phase1-app-' + Date.now();
const compose = ['compose', '-p', project, '-f', 'tests/compose.test.yml'];
let owns = false,
  appCreated = false,
  gatewayCreated = false;
const gatewayName = name + '-gateway';
const gatewayImage =
  'nginx:1.30.6-alpine@sha256:0e52bd054126cdc040b1276c0af347aeb02a41b9cfe305d6094767ac30e97949';
function command(args) {
  return spawnSync('docker', args, { env, encoding: 'utf8', timeout: 240000, maxBuffer: 16000000 });
}
function step(label, cmd, args, extra = {}) {
  const r = spawnSync(cmd, args, {
    env,
    encoding: 'utf8',
    timeout: 240000,
    maxBuffer: 16000000,
    ...extra,
  });
  writeFileSync('.cache/works-phase1/' + label + '.log', (r.stdout ?? '') + (r.stderr ?? ''));
  results.push({ label, status: r.status === 0 ? 'PASS' : 'FAIL', exit: r.status });
  console.log(results.at(-1).status + ': ' + label);
  if (r.status !== 0) throw Error(label + ' failed: ' + (r.stdout + r.stderr).slice(-3500));
  return r.stdout;
}
const existing = command(['ps', '-a', '--format', '{{.Names}}']);
if (existing.status !== 0 || existing.stdout.split('\n').some((n) => n.startsWith(project + '-')))
  throw Error('Disposable namespace unavailable/occupied; no resources adopted');
const baseBefore = new Map(
  ['postgres:17-alpine', 'redis:7-alpine', ...(acceptance ? [gatewayImage] : [])].map((ref) => [
    ref,
    command(['image', 'inspect', ref]).status === 0,
  ]),
);
try {
  owns = true;
  step('test-services', 'docker', [...compose, 'up', '-d', '--wait']);
  const old = '.cache/works-phase1/old-migrations';
  mkdirSync(old, { recursive: true });
  const journal = JSON.parse(readFileSync('api/drizzle/meta/_journal.json'));
  journal.entries = journal.entries.filter((e) => e.idx < 8);
  mkdirSync(old + '/meta', { recursive: true });
  writeFileSync(old + '/meta/_journal.json', JSON.stringify(journal));
  for (const entry of journal.entries)
    copyFileSync('api/drizzle/' + entry.tag + '.sql', old + '/' + entry.tag + '.sql');
  step('previous-migrations', bun, [
    '--no-env-file',
    '--no-install',
    '-e',
    "import {drizzle} from './api/node_modules/drizzle-orm/postgres-js';import{migrate}from './api/node_modules/drizzle-orm/postgres-js/migrator';import{sql}from './api/src/db/client.ts';await migrate(drizzle(sql),{migrationsFolder:'.cache/works-phase1/old-migrations'});await sql.end();",
  ]);
  step('legacy-fixture', bun, [
    '--no-env-file',
    '--no-install',
    '-e',
    "import{sql}from './api/src/db/client.ts';await sql\x60INSERT INTO users(email,name,role) VALUES('portfolio-legacy@test.invalid','Preserve existing user','user')\x60;await sql.end();",
  ]);
  step('migration', bun, ['--no-env-file', '--no-install', '--cwd', 'api', 'src/db/migrate.ts']);
  step('migration-rerun', bun, [
    '--no-env-file',
    '--no-install',
    '--cwd',
    'api',
    'src/db/migrate.ts',
  ]);
  step('legacy-preserved', bun, [
    '--no-env-file',
    '--no-install',
    '-e',
    "import{sql}from './api/src/db/client.ts';const rows=await sql\x60SELECT name FROM users WHERE email='portfolio-legacy@test.invalid'\x60;if(rows[0]?.name!=='Preserve existing user')throw Error('Legacy user lost');console.log('Existing user preserved');await sql.end();",
  ]);
  step('portfolio-integration', bun, [
    '--no-env-file',
    '--no-install',
    'test',
    'tests/security/portfolio.test.ts',
  ]);
  if (sampleTest) {
    env.SAMPLE_WORK_ADMIN_EMAIL = 'portfolio-sample@test.invalid';
    step('sample-admin', bun, [
      '--no-env-file',
      '--no-install',
      '-e',
      "import{sql}from './api/src/db/client.ts';await sql\x60INSERT INTO users(email,name,role) VALUES('portfolio-sample@test.invalid','Sample importer','admin')\x60;await sql.end();",
    ]);
    step('sample-import', bun, [
      '--no-env-file',
      '--no-install',
      'api/src/db/seed-portfolio-sample.ts',
      '--confirm-sample',
    ]);
    step('sample-import-repeat', bun, [
      '--no-env-file',
      '--no-install',
      'api/src/db/seed-portfolio-sample.ts',
      '--confirm-sample',
    ]);
    step('sample-single-record', bun, [
      '--no-env-file',
      '--no-install',
      '-e',
      "import{sql}from './api/src/db/client.ts';const r=await sql\x60SELECT count(*)::int n FROM portfolio_works WHERE slug='nesomn-studio-kit' AND is_sample AND client IS NULL\x60;if(r[0]?.n!==1)throw Error('Expected exactly one internal sample');await sql.end();",
    ]);
  }
  step('docker-build', 'docker', ['build', '--target', 'app', '-t', tag, '.']);
  const runtime = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://nesomn_test:nesomn_test@test-db:5432/nesomn_revision_test',
    REDIS_URL: 'redis://test-redis:6379/0',
    JWT_SECRET: env.JWT_SECRET,
    ENCRYPTION_KEY: env.ENCRYPTION_KEY,
    CLIENT_URL: acceptance ? 'http://127.0.0.1:18092' : 'https://studio.example.test',
    ADMIN_URL: acceptance ? 'http://127.0.0.1:18092' : 'https://studio.example.test',
    STORAGE_DRIVER: 'local',
    STORAGE_PATH: '/data/storage',
  };
  const launch = [
    'run',
    '-d',
    '--name',
    name,
    '--label',
    'nesomn.test=works-phase1',
    '--network',
    project + '_default',
    '--read-only',
    '--tmpfs',
    '/tmp',
    '--tmpfs',
    '/data/storage:uid=1000,gid=1000',
  ];
  if (acceptance) launch.push('--network-alias', 'app');
  for (const [k, v] of Object.entries(runtime)) launch.push('-e', k + '=' + v);
  launch.push(tag);
  step('app-start', 'docker', launch);
  appCreated = true;
  const smoke =
    "for(let i=0;i<100;i++){try{const r=await fetch('http://localhost:3000/health/ready');if(r.ok)break}catch{}await Bun.sleep(100);}const rows=[];for(const[path,expected]of [['/health/ready',200],['/admin/works',200],['/admin/works/create',200],['/api/works',200],['/api/admin/works',401]]){const r=await fetch('http://localhost:3000'+path);rows.push({path,status:r.status});if(r.status!==expected)throw Error(JSON.stringify(rows));}console.log(JSON.stringify(rows));";
  step('app-smoke', 'docker', ['exec', name, 'bun', '--no-env-file', '-e', smoke]);
  if (acceptance) {
    step('gateway-start', 'docker', [
      'run',
      '-d',
      '--name',
      gatewayName,
      '--label',
      'nesomn.test=marketing-phase5',
      '--network',
      project + '_default',
      '-p',
      '127.0.0.1:18092:8080',
      '--read-only',
      '--tmpfs',
      '/tmp',
      '--user',
      'nginx',
      '--entrypoint',
      'nginx',
      '-v',
      resolve('nginx.conf') + ':/etc/nginx/nginx.conf:ro',
      '-v',
      resolve('deploy/nginx/trusted-proxies.conf') + ':/etc/nginx/trusted-proxies.conf:ro',
      gatewayImage,
      '-g',
      'daemon off;',
    ]);
    gatewayCreated = true;
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        if ((await fetch('http://127.0.0.1:18092/health/ready')).ok) break;
      } catch { /* Retry while Nginx starts. */ }
      await new Promise((r) => setTimeout(r, 100));
    }
    const http = [];
    for (const [path, status, type] of [
      ['/health/live', 200, 'json'],
      ['/health/ready', 200, 'json'],
      ['/landing', 200, 'html'],
      ['/works', 200, 'html'],
      ['/works/nesomn-studio-kit', 200, 'html'],
      ['/about', 200, 'html'],
      ['/demo/works/nesomn-studio-kit', 200, 'html'],
      ['/demo/3d?model=nesomn-studio-kit', 200, 'html'],
      ['/admin/works', 200, 'html'],
      ['/admin/works/create', 200, 'html'],
      ['/api/works', 200, 'json'],
      ['/api/admin/works', 401, 'json'],
      ['/api/no-such-route', 404, 'json'],
      ['/assets/missing.js', 404, 'plain'],
      ['/admin/assets/missing.js', 404, 'plain'],
    ]) {
      const response = await fetch('http://127.0.0.1:18092' + path);
      const row = { path, status: response.status, type: response.headers.get('content-type') };
      http.push(row);
      if (row.status !== status || !row.type?.includes(type))
        throw Error('Gateway routing failed: ' + JSON.stringify(row));
    }
    writeFileSync(folder + '/gateway.json', JSON.stringify(http, null, 2));
    const client = resolve('.cache/marketing-phase5/client'),
      admin = resolve('.cache/marketing-phase5/admin');
    mkdirSync(client, { recursive: true });
    mkdirSync(admin, { recursive: true });
    step('extract-client', 'docker', ['cp', name + ':/app/client/dist/.', client]);
    step('extract-admin', 'docker', ['cp', name + ':/app/admin/dist/.', admin]);
    const browserEnv = {
      ...env,
      NESOMN_DISPOSABLE_TESTS: '1',
      NESOMN_RELEASE_LAB: '1',
      NESOMN_ARTIFACT_ROOT: folder + '/browser',
      NESOMN_UI_DIST: client,
      NESOMN_ADMIN_DIST: admin,
    };
    for (const test of ['domains-ui', 'works-public', 'studio-kit-viewer', 'admin'])
      step('browser-' + test, 'node', ['tests/' + test + '-browser.mjs'], { env: browserEnv });
  }
} catch (error) {
  results.push({ label: 'run', status: 'FAIL', error: error.message });
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (gatewayCreated) step('cleanup-gateway', 'docker', ['rm', '-f', gatewayName]);
  if (appCreated) step('cleanup-app', 'docker', ['rm', '-f', name]);
  if (owns) step('cleanup-services', 'docker', [...compose, 'down']);
  for (const ref of [tag, ...[...baseBefore].filter(([, before]) => !before).map(([ref]) => ref)]) {
    if (command(['image', 'inspect', ref]).status !== 0) continue;
    const used = command(['ps', '-aq', '--filter', 'ancestor=' + ref]);
    if (used.stdout.trim()) continue;
    step('cleanup-image-' + ref.replace(/[^a-z0-9]/g, '-'), 'docker', ['image', 'rm', ref]);
  }
  writeFileSync(
    folder + '/integration.json',
    JSON.stringify(
      {
        results,
        productionDatabase: false,
        merchantTransactions: false,
        volumesDeleted: false,
        globalPrune: false,
      },
      null,
      2,
    ),
  );
}
