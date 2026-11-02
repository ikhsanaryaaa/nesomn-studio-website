import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const release = process.env.NESOMN_RELEASE_LAB === '1';
export function chromeExecutable() {
  const candidate = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].find(existsSync);
  if (!candidate) throw Error('BLOCKED: Chrome/Chromium executable unavailable');
  return candidate;
}
export function artifactDirectory(surface, historical) {
  if (!/^[a-z0-9-]+$/.test(surface)) throw Error('Invalid browser surface');
  const folder = release ? 'docs/revision/artifacts/phase-10/' + surface : historical;
  mkdirSync(folder, { recursive: true });
  return folder;
}
export function cacheDirectory(surface, historical) {
  if (!/^[a-z0-9-]+$/.test(surface)) throw Error('Invalid browser surface');
  return release ? '.cache/revision-phase-10/' + surface : historical;
}
export function labBase(historical) {
  return release ? 'http://127.0.0.1:18092' : historical;
}
export function labApp(historical) {
  return release ? 'nesomn-release-test-app-1' : historical;
}
export function fixtureBun() {
  const local = resolve('.cache/runtime/bun-1.4.4/bun-windows-x64/bun.exe');
  return existsSync(local) ? local : 'bun';
}

/** Collect failure diagnostics without storing URL queries, cookies or console argument values. */
export function createBrowserDiagnostics() {
  const paths = new Map();
  const safePath = (value) => {
    try {
      const u = new URL(value);
      return u.origin + u.pathname;
    } catch {
      return 'unknown';
    }
  };
  const result = {
    consoleErrors: 0,
    consoleWarnings: 0,
    failedRequests: [],
    httpErrors: [],
    capture(message) {
      const p = message.params ?? {};
      if (message.method === 'Network.requestWillBeSent')
        paths.set(p.requestId, safePath(p.request?.url));
      if (message.method === 'Runtime.consoleAPICalled') {
        if (p.type === 'error') result.consoleErrors++;
        if (p.type === 'warning') result.consoleWarnings++;
      }
      if (message.method === 'Network.loadingFailed' && result.failedRequests.length < 100)
        result.failedRequests.push({
          path: paths.get(p.requestId) ?? 'unknown',
          error: p.errorText,
        });
      if (
        message.method === 'Network.responseReceived' &&
        p.response?.status >= 400 &&
        result.httpErrors.length < 100
      )
        result.httpErrors.push({ path: safePath(p.response.url), status: p.response.status });
    },
  };
  return result;
}
