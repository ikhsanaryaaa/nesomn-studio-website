import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { chromeExecutable, launchChrome, waitChromeReady } from './lib/browser-runtime.mjs';
import { releaseEnvironment } from '../scripts/release-check.mjs';

if (!process.argv.includes('--child')) {
  const { env } = releaseEnvironment('unit');
  const result = spawnSync(process.execPath, [process.argv[1], '--child'], {
    env,
    stdio: 'inherit',
    windowsHide: true,
    timeout: 45000,
  });
  process.exitCode = result.status ?? 1;
} else {
  const root = resolve(tmpdir());
  const profile = mkdtempSync(join(root, 'nesomn-chrome-startup-'));
  assert.ok(profile.startsWith(join(root, 'nesomn-chrome-startup-')));
  const chrome = launchChrome(
    chromeExecutable(),
    [
      '--headless=new',
      '--no-first-run',
      '--no-default-browser-check',
      '--remote-debugging-port=9236',
      '--user-data-dir=' + profile,
    ],
    { windowsHide: true },
  );
  try {
    await waitChromeReady(chrome, 9236);
    console.log('PASS: Chrome debug endpoint is available in the sanitized release environment');
  } finally {
    chrome.kill();
    if (chrome.exitCode === null)
      await Promise.race([
        new Promise((r) => chrome.once('exit', r)),
        new Promise((r) => setTimeout(r, 2000)),
      ]);
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}
