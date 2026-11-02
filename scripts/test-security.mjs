import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { createTestInvocation } from './test-baseline.mjs';
const mode = process.argv[2] ?? 'unit';
if (!['unit', 'integration'].includes(mode) || process.argv.length > 3)
  throw new Error('Use unit or integration');
const { env } = createTestInvocation(mode, process.env);
const files =
  mode === 'unit'
    ? ['guards', 'periods', 'validation']
    : [
        'credit-integrity',
        'settlement',
        'jobs',
        'boundaries',
        'oauth',
        'queue',
        'migration-upgrade',
        'subscriptions',
      ];
if (mode === 'integration') env.NESOMN_DISPOSABLE_TESTS = '1';
const result = spawnSync(
  'bun',
  [
    '--no-env-file',
    '--no-install',
    'test',
    ...files.map((file) => `tests/security/${file}.test.ts`),
  ],
  { env, stdio: 'inherit', windowsHide: true, timeout: 120000 },
);
process.exitCode = result.status ?? 1;
