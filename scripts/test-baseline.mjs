import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { connect } from 'node:net';
import { URL, fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = {
  unit: [
    './api/src/lib/admin-query.test.ts',
    './api/src/lib/crypto.test.ts',
    './api/src/lib/password.test.ts',
    './api/src/modules/catalog/pricing.test.ts',
    './tests/scene-compatibility.test.ts',
  ],
  integration: [
    './api/src/modules/auth/auth.test.ts',
    './api/src/modules/session/service.test.ts',
    './api/src/modules/project/routes.test.ts',
    './api/src/modules/ai/credit.test.ts',
    './api/src/modules/ai/routes.test.ts',
    './api/src/modules/billing/routes.test.ts',
    './api/src/modules/billing/retention.test.ts',
    './worker/src/process-job.test.ts',
  ],
};

/** Hanya environment OS dan nilai sintetis; tidak membaca file .env. */
export function createTestInvocation(mode, parentEnv) {
  if (!Object.hasOwn(files, mode)) throw new Error('Mode harus unit atau integration.');
  if (mode === 'integration' && parentEnv.NESOMN_DISPOSABLE_TESTS !== '1') {
    throw new Error('Integration membutuhkan NESOMN_DISPOSABLE_TESTS=1 dan database disposable dari tests/compose.test.yml.');
  }
  const osKeys = /^(path|pathext|systemroot|windir|comspec|temp|tmp|home|userprofile|localappdata|appdata|lang|lc_all|term|number_of_processors|processor_architecture)$/i;
  const env = Object.fromEntries(Object.entries(parentEnv).filter(([key]) => osKeys.test(key)));
  Object.assign(env, {
    NODE_ENV: 'test',
    ALLOW_PAYMENT_STUB: 'true',
    ALLOW_AI_STUB: 'true',
    CI: '1',
    DATABASE_URL: 'postgresql://nesomn_test:nesomn_test@127.0.0.1:55432/nesomn_revision_test',
    REDIS_URL: 'redis://127.0.0.1:56379/0',
    JWT_SECRET: 'synthetic-baseline-jwt-secret-never-for-production',
    ENCRYPTION_KEY: 'synthetic-baseline-encryption-key-never-production',
    STORAGE_DRIVER: 'local',
    CLIENT_URL: 'http://localhost:5173',
    ADMIN_URL: 'http://localhost:5174',
    NO_COLOR: '1',
  });
  return { args: ['--no-env-file', '--no-install', 'test', ...files[mode]], env };
}

function checkPort(port) {
  return new Promise((resolve, reject) => {
    const socket = connect({ host: '127.0.0.1', port });
    const finish = (error) => {
      socket.destroy();
      if (error) reject(new Error(`Dependency test 127.0.0.1:${port} tidak tersedia (${error.code ?? error.message}).`));
      else resolve();
    };
    socket.setTimeout(1000, () => finish(new Error('timeout')));
    socket.once('error', finish);
    socket.once('connect', () => finish());
  });
}

async function main() {
  const mode = process.argv[2] ?? 'unit';
  let invocation;
  try {
    if (process.argv.length > 3) throw new Error('Argumen tambahan tidak didukung.');
    invocation = createTestInvocation(mode, process.env);
    if (mode === 'integration') {
      await Promise.all([checkPort(55432), checkPort(56379)]);
    }
  } catch (error) {
    process.stderr.write(`BLOCKED: ${error.message}\n`);
    process.exitCode = 2;
    return;
  }
  process.stdout.write(`Baseline ${mode}: Bun, .env disabled, auto-install disabled, synthetic environment.\n`);
  const result = spawnSync('bun', invocation.args, {
    cwd: root,
    env: invocation.env,
    stdio: 'inherit',
    timeout: 120_000,
    windowsHide: true,
  });
  if (result.error) process.stderr.write(`Runner: ${result.error.message}\n`);
  process.exitCode = result.status ?? 1;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main();
}
