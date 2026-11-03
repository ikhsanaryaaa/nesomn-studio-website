import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname, delimiter } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createTestInvocation } from './test-baseline.mjs';

export function releaseEnvironment(mode, parent = process.env) {
  if (!['unit', 'integration'].includes(mode)) throw Error('Use unit or integration');
  const { env } = createTestInvocation(mode === 'integration' ? 'integration' : 'unit', parent);
  const local = resolve('.cache/runtime/bun-1.4.4/bun-windows-x64/bun.exe');
  const bun = existsSync(local) ? local : 'bun';
  if (existsSync(local)) {
    for (const key of Object.keys(env)) if (key.toLowerCase() === 'path') delete env[key];
    env.PATH = dirname(local) + delimiter + (parent.PATH ?? parent.Path ?? '');
  }
  for (const [key, value] of Object.entries(parent))
    if (/^(programfiles(?:\(x86\))?|programdata)$/i.test(key)) env[key] = value;
  if (mode === 'integration') env.NESOMN_DISPOSABLE_TESTS = '1';
  return { bun, env };
}

export function releaseCases(mode, bun) {
  if (mode === 'integration')
    return [
      ['baseline', 'node', ['scripts/test-baseline.mjs', 'integration']],
      ['security', 'node', ['scripts/test-security.mjs', 'integration']],
      ['qris', 'node', ['scripts/test-qris.mjs', 'integration']],
      ['viewer', 'node', ['scripts/test-viewer.mjs', 'integration']],
      [
        'preview-upload',
        bun,
        [
          '--no-env-file',
          '--no-install',
          'test',
          'tests/security/previews.test.ts',
          'tests/security/editor-images.test.ts',
          'tests/security/admin-workflows.test.ts',
          'tests/security/bundle-integrity.test.ts',
          'tests/security/portfolio.test.ts',
        ],
      ],
    ];
  if (mode !== 'unit') throw Error('Use unit or integration');
  return [
    ['frozen', bun, ['install', '--no-env-file', '--frozen-lockfile']],
    ['dependency-audit', bun, ['--no-env-file', 'audit']],
    ['typecheck', bun, ['run', 'typecheck']],
    ['lint', bun, ['run', 'lint']],
    ['build', bun, ['run', 'build']],
    [
      'node-guards',
      'node',
      [
        '--test',
        'tests/baseline-runner.test.mjs',
        'tests/runtime-pin.test.mjs',
        'tests/litepod-build.test.mjs',
        'tests/prerender-exit.test.mjs',
        'tests/browser-bootstrap.test.mjs',
        'tests/browser-startup.test.mjs',
        'tests/release-runner.test.mjs',
        'tests/design-tokens.test.mjs',
        'tests/no-tailwind.test.mjs',
        'tests/english-ui.test.mjs',
      ],
    ],
    ['ui-components', bun, ['run', '--cwd', 'client', 'test:ui']],
    ['baseline', 'node', ['scripts/test-baseline.mjs', 'unit']],
    ['deployment', 'node', ['scripts/test-deployment.mjs']],
    ['compose', 'node', ['scripts/check-deployment.mjs']],
    ['security', 'node', ['scripts/test-security.mjs', 'unit']],
    ['qris', 'node', ['scripts/test-qris.mjs', 'unit']],
    ['viewer', 'node', ['scripts/test-viewer.mjs', 'unit']],
    ['glb', 'node', ['scripts/validate-demo-models.mjs']],
    ['scene', 'node', ['scripts/test-phase9.mjs', 'unit']],
    [
      'theme-navigation',
      bun,
      [
        '--no-env-file',
        '--no-install',
        'test',
        'tests/theme.test.ts',
        'tests/litepod.test.ts',
        'tests/navigation.test.ts',
        'tests/public-flow.test.ts',
        'tests/release-ci.test.ts',
        'tests/patch-validation.test.ts',
        'tests/admin-rest.test.ts',
        'tests/portfolio.test.ts',
        'tests/public-portfolio.test.ts',
        'admin/tests/works-api.test.ts',
      ],
    ],
  ];
}

export async function runReleaseChecks(mode, parent = process.env) {
  const { bun, env } = releaseEnvironment(mode, parent);
  const expected = readFileSync('.bun-version', 'utf8').trim();
  const version = spawnSync(bun, ['--version'], { env, encoding: 'utf8', windowsHide: true });
  if (version.status !== 0 || version.stdout.trim() !== expected)
    throw Error('Expected Bun ' + expected + ', selected runtime unavailable or mismatched');
  const folder = resolve('.cache/revision-phase-10/' + mode);
  mkdirSync(folder, { recursive: true });
  const results = [];
  for (const [name, command, args] of releaseCases(mode, bun)) {
    const start = Date.now();
    const r = spawnSync(command, args, {
      env: { ...env, ...(name === 'build' ? { NODE_ENV: 'production' } : {}) },
      encoding: 'utf8',
      windowsHide: true,
      timeout: 240000,
      maxBuffer: 16 * 1024 * 1024,
    });
    const output = (r.stdout ?? '') + (r.stderr ?? '') + (r.error ? '\n' + r.error.message : '');
    writeFileSync(resolve(folder, name + '.log'), output);
    results.push({
      name,
      command,
      args,
      status: r.status === 0 ? 'PASS' : 'FAIL',
      exit: r.status,
      milliseconds: Date.now() - start,
    });
    writeFileSync(
      resolve(folder, 'results.json'),
      JSON.stringify({ bun: expected, mode, results }, null, 2),
    );
    console.log(results.at(-1).status + ': ' + name);
    if (r.status !== 0) {
      console.error(output.slice(-6000));
      throw Error('Release check failed: ' + name);
    }
  }
  return results;
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  if (process.argv.length > 3) throw Error('Use unit or integration');
  await runReleaseChecks(process.argv[2] ?? 'unit');
}
