import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { chromeExecutable, launchChrome } from './lib/browser-runtime.mjs';
import { releaseEnvironment } from '../scripts/release-check.mjs';

if (!process.argv.includes('--child')) {
  const { env } = releaseEnvironment('unit');
  const result = spawnSync(process.execPath, [process.argv[1], '--child'], {
    env,
    stdio: 'inherit',
    windowsHide: true,
    timeout: 20000,
  });
  process.exitCode = result.status ?? 1;
} else {
  const root = resolve(tmpdir());
  const profile = mkdtempSync(join(root, 'nesomn-chrome-startup-'));
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
  let version;
  try {
    for (let i = 0; i < 60; i++) {
      if (chrome.exitCode !== null) break;
      try {
        version = await (
          await fetch('http://127.0.0.1:9236/json/version', { signal: AbortSignal.timeout(500) })
        ).json();
        if (version.webSocketDebuggerUrl) break;
      } catch {
        /* Same startup path and deadline as the browser acceptance suite. */
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.ok(version?.webSocketDebuggerUrl, chrome.startupDiagnostics());
    console.log('PASS: Chrome debug endpoint is available in the sanitized release environment');
  } finally {
    chrome.kill();
    if (chrome.exitCode === null)
      await Promise.race([
        new Promise((r) => chrome.once('exit', r)),
        new Promise((r) => setTimeout(r, 2000)),
      ]);
    if (!profile.startsWith(join(root, 'nesomn-chrome-startup-')))
      throw Error('Unsafe profile cleanup');
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}
