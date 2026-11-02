import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname, delimiter } from 'node:path';
import { createTestInvocation } from './test-baseline.mjs';
const mode = process.argv[2] ?? 'unit';
if (!['unit', 'integration', 'browser', 'gateway'].includes(mode) || process.argv.length > 3) throw Error('Use unit, integration, browser or gateway');
const needsDb = mode === 'integration' || mode === 'gateway';
const env = createTestInvocation(needsDb ? 'integration' : 'unit', process.env).env;
if (needsDb) env.NESOMN_DISPOSABLE_TESTS = '1';
const local = resolve('.cache/runtime/bun-1.4.4/bun-windows-x64/bun.exe');
const bun = existsSync(local) ? local : 'bun';
if (existsSync(local)) {
  for (const key of Object.keys(env)) if (key.toLowerCase() === 'path') delete env[key];
  env.PATH = dirname(local) + delimiter + process.env.PATH;
}
const version = spawnSync(bun, ['--version'], { env, encoding: 'utf8', windowsHide: true });
if (version.stdout?.trim() !== '1.4.4') throw Error('Bun 1.4.4 required (global or local pinned runtime)');
const cases = mode === 'unit'
  ? [[bun, ['--no-env-file', '--no-install', 'test', 'tests/scene-export.test.ts', 'tests/scene-compatibility.test.ts', 'tests/editor-bugs.test.ts']]]
  : mode === 'integration'
    ? [[bun, ['--no-env-file', '--no-install', 'test', 'tests/security/previews.test.ts', 'tests/security/editor-images.test.ts']], ['node', ['scripts/test-security.mjs', 'integration']]]
    : [['node', [mode === 'browser' ? 'tests/editor-admin-browser.mjs' : 'tests/editor-gateway-browser.mjs']]];
for (const [command, args] of cases) {
  const result = spawnSync(command, args, { env, stdio: 'inherit', windowsHide: true, timeout: 180000 });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
