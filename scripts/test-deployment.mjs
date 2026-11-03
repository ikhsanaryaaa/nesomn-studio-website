import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { createTestInvocation } from './test-baseline.mjs';

const { env } = createTestInvocation('unit', process.env);
const result = spawnSync('bun', ['--no-env-file', '--no-install', 'test',
  './tests/deployment/runtime-env.test.ts', './tests/deployment/web-app.test.ts', './tests/deployment/readiness.test.ts', './tests/deployment/domain-origin.test.ts', './tests/deployment/api-media.test.ts',
], { env, stdio: 'inherit', windowsHide: true, timeout: 30000 });
process.exitCode = result.status ?? 1;
