import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { createTestInvocation } from './test-baseline.mjs';
const mode = process.argv[2] ?? 'unit';
if (!['unit', 'integration'].includes(mode) || process.argv.length > 3)
  throw Error('Use unit or integration');
const { env } = createTestInvocation(mode, process.env);
if (mode === 'integration') env.NESOMN_DISPOSABLE_TESTS = '1';
const files =
  mode === 'unit'
    ? ['tests/viewer.test.ts', 'tests/recording.test.ts']
    : ['tests/editor3d.integration.test.ts'];
const r = spawnSync('bun', ['--no-env-file', '--no-install', 'test', ...files], {
  env,
  stdio: 'inherit',
  windowsHide: true,
  timeout: 120000,
});
process.exitCode = r.status ?? 1;
