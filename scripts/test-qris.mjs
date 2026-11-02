import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { createTestInvocation } from './test-baseline.mjs';

const mode = process.argv[2] ?? 'unit';
if (!['unit', 'integration'].includes(mode) || process.argv.length > 3)
  throw new Error('Use unit or integration');
const { env } = createTestInvocation(mode, process.env);
if (mode === 'integration') env.NESOMN_DISPOSABLE_TESTS = '1';
const result = spawnSync(
  'bun',
  [
    '--no-env-file',
    '--no-install',
    'test',
    `tests/qris/${mode === 'unit' ? 'pure' : 'integration'}.test.ts`,
  ],
  { env, stdio: 'inherit', windowsHide: true, timeout: 120000 },
);
process.exitCode = result.status ?? 1;
