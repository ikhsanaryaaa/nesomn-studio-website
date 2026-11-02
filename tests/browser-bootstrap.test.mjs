import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { createTestInvocation } from '../scripts/test-baseline.mjs';

test('built client bootstrap settles module imports and reaches the browser root', () => {
  const assets = resolve(process.env.NESOMN_CLIENT_DIST || 'client/dist', 'assets');
  const entry = readdirSync(assets).find((name) => name.endsWith('.js') && /as prerender[},]/.test(readFileSync(resolve(assets, name), 'utf8')));
  assert.ok(entry, 'Build client first');
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    globalThis.window = {
      matchMedia: () => ({ matches: false }),
      localStorage: { getItem: () => null },
    };
    globalThis.self = globalThis;
    globalThis.document = {
      documentElement: { dataset: {}, style: {} },
      createElement: () => ({ relList: { supports: () => true } }),
      querySelectorAll: () => [],
      querySelector: () => ({ getAttribute: () => null }),
      getElementsByTagName: () => [],
      getElementById: () => { throw new Error('BROWSER_BOOT_REACHED'); },
    };
    process.on('unhandledRejection', error => {
      if (error.message === 'BROWSER_BOOT_REACHED') console.log('BROWSER_BOOT_REACHED');
      else { console.error(error); process.exitCode = 1; }
    });
    try { await import(${JSON.stringify(pathToFileURL(resolve(assets, entry)).href)}); }
    catch (error) {
      if (error.message === 'BROWSER_BOOT_REACHED') console.log('BROWSER_BOOT_REACHED');
      else throw error;
    }
    console.log('ENTRY_SETTLED');
  `], { env: createTestInvocation('unit', process.env).env, encoding: 'utf8', timeout: 5000, windowsHide: true });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /ENTRY_SETTLED/);
  assert.match(result.stdout, /BROWSER_BOOT_REACHED/);
});
