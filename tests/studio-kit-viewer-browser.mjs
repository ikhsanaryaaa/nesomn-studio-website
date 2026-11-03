import { selectTheme as selectThemeControl } from './lib/theme-control.mjs';
import { waitChromeReady } from './lib/browser-runtime.mjs';
import { createBrowserDiagnostics } from './lib/browser-runtime.mjs';
import { chromeExecutable, artifactDirectory, cacheDirectory } from './lib/browser-runtime.mjs';
// Compiled production assets, explicit offline API-failure fixture; never a live backend.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { launchChrome } from './lib/browser-runtime.mjs';
const root = resolve(process.env.NESOMN_UI_DIST ?? 'client/dist');
const admin = resolve(process.env.NESOMN_ADMIN_DIST ?? 'admin/dist');
const folder = resolve(
  process.env.NESOMN_UI_ARTIFACTS ??
    artifactDirectory('studio-kit-viewer', 'docs/revision/artifacts/phase4-2026-11-03'),
);
mkdirSync(folder, { recursive: true });
const mime = {
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.html': 'text/html',
  '.png': 'image/png',
};
let catalogMode = 'error';
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.headers.origin === 'http://localhost:18120') {
    res.setHeader('access-control-allow-origin', req.headers.origin);
    res.setHeader('access-control-allow-credentials', 'true');
  }
  if (url.pathname === '/api/catalog/assets' && catalogMode !== 'error') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify(
        catalogMode === 'empty'
          ? []
          : catalogMode === 'invalid'
            ? [{}]
            : [
                {
                  id: 'fixture-asset',
                  slug: 'fixture-sample',
                  title: 'Demo / Sample fixture asset',
                  type: 'graphic',
                  tier: 'free',
                  priceIdr: '0',
                  previews: ['/demo/models/nesomn-product-box.svg'],
                },
              ],
      ),
    );
    return;
  }
  if (url.pathname.startsWith('/api/')) {
    res.writeHead(url.pathname.includes('me') ? 401 : 503, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'Explicit offline browser fixture' } }));
    return;
  }
  const isAdmin =
      url.pathname.startsWith('/admin/') ||
      (process.env.NESOMN_SPLIT_BROWSER === '1' && req.headers.host === 'localhost:18120'),
    base = isAdmin ? admin : root;
  const path = resolve(
    base,
    '.' +
      decodeURIComponent(
        isAdmin && url.pathname.startsWith('/admin/') ? url.pathname.slice(6) : url.pathname,
      ),
  );
  if (path !== base && !path.startsWith(base + '/') && !path.startsWith(base + '\\')) {
    res.writeHead(404);
    res.end();
    return;
  }
  const file = extname(path) ? path : resolve(base, 'index.html');
  if (!existsSync(file)) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { 'content-type': mime[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(18120, '127.0.0.1', r));
const chrome = launchChrome(
  chromeExecutable(),
  [
    '--headless=new',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=9280',
    '--user-data-dir=' +
      resolve(
        cacheDirectory('studio-kit-viewer', '.cache/revision-phase-6/browser-profile') +
          '/browser-profile',
      ),
  ],
  { windowsHide: true, stdio: 'ignore' },
);
const diagnostics = createBrowserDiagnostics();
let ws,
  session,
  seq = 0;
const requests = new Map(),
  errors = [];
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
function send(method, params = {}, sid = session) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    requests.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, ...(sid ? { sessionId: sid } : {}) }));
  });
}
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw Error(r.exceptionDetails.text);
  return r.result.value;
}
async function wait(expression) {
  for (let i = 0; i < 100; i++) {
    if (await evaluate('Boolean(' + expression + ')')) return;
    await delay(100);
  }
  throw Error('Timeout ' + expression);
}
async function go(path) {
  await send('Page.navigate', {
    url:
      process.env.NESOMN_SPLIT_BROWSER === '1' && path.startsWith('/admin/')
        ? 'http://localhost:18120' + path.slice(6)
        : 'http://127.0.0.1:18120' +
          (process.env.NESOMN_SPLIT_BROWSER === '1' && path === '/landing' ? '/' : path),
  });
  await wait(
    'document.readyState==="complete"&&document.querySelector("#root")?.children.length>0',
  );
  await delay(400);
}
async function selectTheme(mode) {
  await selectThemeControl(evaluate, wait, mode);
  await delay(450);
}

async function screenshot(name, width) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: width < 600,
  });
  await evaluate('window.scrollTo(0,0)');
  await delay(250);
  const dimensions = await evaluate(
    '({width:innerWidth,scroll:document.documentElement.scrollWidth})',
  );
  assert.ok(dimensions.scroll <= dimensions.width, name + ' overflow');
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(resolve(folder, name + '.png'), Buffer.from(r.data, 'base64'));
  return dimensions;
}
try {
  const version = await waitChromeReady(chrome, 9280);

  ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  ws.addEventListener('message', (e) => {
    const d = JSON.parse(e.data);
    diagnostics.capture(d);
    if (d.id) {
      const p = requests.get(d.id);
      requests.delete(d.id);
      if (p) {
        if (d.error) p.reject(Error(d.error.message));
        else p.resolve(d.result);
      }
    }
    if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.text);
  });
  const target = await send('Target.createTarget', { url: 'about:blank' }, null);
  session = (
    await send('Target.attachToTarget', { targetId: target.targetId, flatten: true }, null)
  ).sessionId;
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');

  await go('/demo/3d?model=nesomn-studio-kit');
  await wait('document.querySelector(".viewer-stage")?.dataset.state==="ready"');
  assert.ok(
    await evaluate(
      'document.querySelector(".demo-model-title").textContent.includes("Studio Kit")',
    ),
  );
  for (const theme of ['light', 'dark']) {
    await selectTheme(theme);
    if (theme === 'dark')
      await evaluate(
        '[...document.querySelectorAll(".viewer-toolbar button")].find(b=>b.textContent.includes("Background:")).click()',
      );
    for (const width of [390, 768, 1440])
      await screenshot('studio-kit-' + theme + '-' + width, width);
  }
  await evaluate(
    '[...document.querySelectorAll(".viewer-toolbar button")].find(b=>b.textContent==="Reset View").click()',
  );
  for (let pass = 0; pass < 2; pass++) {
    for (let index = 0; index < 5; index++) {
      await evaluate('document.querySelectorAll(".demo-model-picker button")[' + index + '].click()');
      await delay(250);
      await wait('document.querySelector(".viewer-stage")?.dataset.state==="ready"');
    }
  }
  await go('/landing');
  await wait('document.querySelector(".hero-workflow")');
  for (const theme of ['light', 'dark']) {
    await selectTheme(theme);
    for (const width of [360, 390, 768, 1024, 1440])
      await screenshot('hero-' + theme + '-' + width, width);
  }
  assert.deepEqual(errors, []);
  writeFileSync(
    resolve(folder, 'browser.json'),
    JSON.stringify(
      {
        studioKitRendered: true,
      modelSwitches: 10,
        reset: true,
        heroWidths: [360, 390, 768, 1024, 1440],
        exceptions: errors,
      },
      null,
      2,
    ),
  );
  console.log('PASS embedded StudioKit GLB actualWebGL desktop/mobile and hero5widths2themes');
} finally {
  if (ws?.readyState === 1) {
    try {
      await send('Browser.close', {}, null);
    } catch {
      /* browser closes transport */
    }
    ws.close();
  }
  chrome.kill();
  await new Promise((r) => server.close(r));
}
