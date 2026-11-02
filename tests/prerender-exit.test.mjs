import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { createTestInvocation } from '../scripts/test-baseline.mjs';

test('production assets tidak menyertakan React development build', () => {
  for (const workspace of ['client', 'admin']) {
    const assets = resolve(workspace, 'dist/assets');
    const scripts = readdirSync(assets).filter((name) => name.endsWith('.js'));
    assert.ok(scripts.length, 'Build production assets terlebih dahulu');
    for (const script of scripts) {
      assert.ok(
        !/not wrapped in act|react(?:-dom(?:-client|-server(?:-legacy)?)?(?:\.(?:browser|edge))?)?\.development\.js/.test(
          readFileSync(resolve(assets, script), 'utf8'),
        ),
        `${workspace}/${script} memuat React development build; gunakan NODE_ENV=production`,
      );
    }
  }
});

test('production prerender menghasilkan HTML tiga route dan keluar tanpa open handle', () => {
  const assets = resolve('client/dist/assets');
  const entry = readdirSync(assets).find((name) =>
    name.endsWith('.js') && /as prerender[},]/.test(readFileSync(resolve(assets, name), 'utf8')),
  );
  assert.ok(entry, 'Jalankan bun run build terlebih dahulu');
  const moduleUrl = pathToFileURL(resolve(assets, entry)).href;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    globalThis.self = globalThis;
    globalThis.location = {};
    const { prerender } = await import(${JSON.stringify(moduleUrl)});
    for (const url of ['/', '/pricing', '/marketplace']) {
      const result = await prerender({ url });
      if (!result.html.includes('Nesomn') || result.html.length < 1000 || !result.head.title) {
        throw new Error('Prerender tidak lengkap: ' + url);
      }
      console.log('rendered ' + url);
    }
  `], {
    env: createTestInvocation('unit', process.env).env,
    encoding: 'utf8',
    timeout: 10000,
    windowsHide: true,
  });
  assert.equal(result.error, undefined, `Prerender tertahan: ${result.error?.message}\n${result.stdout}\n${result.stderr}`);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim().split('\n').length, 3);
});
