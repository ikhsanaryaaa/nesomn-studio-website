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
const folder = resolve(artifactDirectory('theme', 'docs/revision/artifacts/phase-6'));
mkdirSync(folder, { recursive: true });
const mime = {
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.html': 'text/html',
  '.png': 'image/png',
};
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    res.writeHead(url.pathname.includes('me') ? 401 : 503, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'Explicit offline browser fixture' } }));
    return;
  }
  const isAdmin = url.pathname.startsWith('/admin/'),
    base = isAdmin ? admin : root;
  const path = resolve(
    base,
    '.' + decodeURIComponent(isAdmin ? url.pathname.slice(6) : url.pathname),
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
await new Promise((r) => server.listen(18086, '127.0.0.1', r));
const chrome = launchChrome(
  chromeExecutable(),
  [
    '--headless=new',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=9236',
    '--user-data-dir=' +
      resolve(
        cacheDirectory('theme', '.cache/revision-phase-6/browser-profile') + '/browser-profile',
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
  await send('Page.navigate', { url: 'http://127.0.0.1:18086' + path });
  await wait(
    'document.readyState==="complete"&&document.querySelector("#root")?.children.length>0',
  );
  await delay(400);
}
async function selectTheme(mode) {
  await evaluate(
    `(()=>{const s=[...document.querySelectorAll('select')].find(s=>s.getBoundingClientRect().height>0);s.value=${JSON.stringify(mode)};s.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
  await wait(`document.documentElement.dataset.theme===${JSON.stringify(mode)}`);
}
async function screenshot(name, width) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: width < 600,
  });
  await delay(250);
  const dimensions = await evaluate(
    '({width:innerWidth,scroll:document.documentElement.scrollWidth})',
  );
  assert.ok(dimensions.scroll <= dimensions.width, name + ' overflow');
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(resolve(folder, name + '.png'), Buffer.from(r.data, 'base64'));
  return dimensions;
}
async function navigation() {
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await go('/marketplace?type=font');
  await evaluate('document.querySelector(\'[aria-label="Buka navigasi"]\').click()');
  await wait('document.querySelector("[role=dialog]")');
  const active = await evaluate(
    'document.querySelector("[role=dialog]").querySelectorAll("nav a[aria-current=page]").length',
  );
  await evaluate(
    'document.querySelector(\'[role=dialog] a[href="/marketplace?type=mockup3d"]\').click()',
  );
  await delay(400);
  const result = {
    activeBefore: active,
    drawerRemainedOpen: await evaluate('!!document.querySelector("[role=dialog]")'),
  };
  writeFileSync(
    cacheDirectory('theme', '.cache/revision-phase-6') + '/navigation-result.json',
    JSON.stringify(result),
  );
  assert.deepEqual(result, { activeBefore: 1, drawerRemainedOpen: false });
  return result;
}
try {
  const version = await waitChromeReady(chrome, 9236);

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
  await send('Emulation.setEmulatedMedia', {
    features: [
      { name: 'prefers-color-scheme', value: 'light' },
      { name: 'prefers-reduced-motion', value: 'reduce' },
    ],
  });
  // A settled reference capture, not a source of product content/colors/assets.
  if (process.env.NESOMN_CAPTURE_REFERENCE === '1') {
    await send('Page.navigate', { url: 'https://ujihub.royyan.net' });
    await delay(5000);
    const r = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(
      cacheDirectory('theme', '.cache/revision-phase-6') + '/reference-settled.png',
      Buffer.from(r.data, 'base64'),
    );
    console.log((await evaluate('document.body.innerText')).slice(0, 400));
  }
  if (process.env.NESOMN_NAV_ONLY === '1') {
    await navigation();
    console.log('PASS navigation');
  } else {
    await go('/');
    await evaluate('localStorage.removeItem("nesomn-theme")');
    await go('/');
    assert.equal(await evaluate('document.documentElement.dataset.theme'), 'light');
    const shots = [];
    for (const mode of ['light', 'dark']) {
      await selectTheme(mode);
      for (const width of [360, 390, 768, 1024, 1440])
        shots.push({ mode, ...(await screenshot('home-' + mode + '-' + width, width)) });
    }
    await send('Page.reload');
    await delay(600);
    await wait(
      '[...document.querySelectorAll("select")].some(s=>Object.keys(s).some(k=>k.startsWith("__reactProps")))',
    );
    assert.equal(await evaluate('document.documentElement.dataset.theme'), 'dark');
    await selectTheme('light');
    await go('/admin/login');
    assert.equal(await evaluate('document.documentElement.dataset.theme'), 'light');
    await screenshot('admin-light-1440', 1440);
    await selectTheme('dark');
    await screenshot('admin-dark-390', 390);
    await go('/');
    assert.equal(await evaluate('document.documentElement.dataset.theme'), 'dark');
    await evaluate('document.fonts.ready.then(()=>true)');
    const fonts = await evaluate(
      '({body:getComputedStyle(document.body).fontFamily,heading:getComputedStyle(document.querySelector("h1")).fontFamily,loaded:document.fonts.check("14px Manrope Variable"),displayLoaded:document.fonts.check("32px Bricolage Grotesque Variable")})',
    );
    assert.match(fonts.heading, /Bricolage/);
    assert.equal(fonts.displayLoaded, true);
    await send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await evaluate('document.querySelector(\'[aria-label="Buka navigasi"]\').click()');
    await wait('document.querySelector("[role=dialog]")');
    for (let i = 0; i < 20; i++) {
      await send('Input.dispatchKeyEvent', {
        type: 'keyDown',
        key: 'Tab',
        code: 'Tab',
        windowsVirtualKeyCode: 9,
      });
      await send('Input.dispatchKeyEvent', {
        type: 'keyUp',
        key: 'Tab',
        code: 'Tab',
        windowsVirtualKeyCode: 9,
      });
      assert.equal(
        await evaluate('!!document.activeElement.closest("[role=dialog]")'),
        true,
        'focus escaped drawer',
      );
    }
    await screenshot('drawer-dark-390', 390);
    await send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'Escape',
      code: 'Escape',
      windowsVirtualKeyCode: 27,
    });
    await send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'Escape',
      code: 'Escape',
      windowsVirtualKeyCode: 27,
    });
    await wait('!document.querySelector("[role=dialog]")');
    // Radix restores focus after the portal is removed; DOM absence alone is not readiness.
    await wait('document.activeElement?.getAttribute("aria-label") === "Buka navigasi"');
    assert.equal(
      await evaluate('document.activeElement.getAttribute("aria-label")'),
      'Buka navigasi',
    );
    await go('/marketplace?type=font&q=sample');
    await wait('document.querySelector("[role=alert]")');
    assert.match(
      await evaluate('document.querySelector("[role=alert]").textContent'),
      /tidak dapat dimuat/,
    );
    assert.equal(
      await evaluate('document.querySelector("input:not(#sidebar-search)")?.value'),
      'sample',
    );
    await screenshot('store-error-dark-390', 390);
    await selectTheme('light');
    await screenshot('store-error-light-1440', 1440);
    await go('/editor/scene');
    await delay(600);
    await screenshot('scene-light-1440', 1440);
    await selectTheme('dark');
    await screenshot('scene-dark-1440', 1440);

    assert.match(fonts.body, /Manrope/);
    assert.equal(fonts.loaded, true);
    assert.deepEqual(errors, []);
    writeFileSync(
      resolve(folder, 'browser.json'),
      JSON.stringify(
        {
          fixture: 'Compiled assets + explicit HTTP401/503 API fixture, no real DB/user/merchant',
          browser: version.Browser,
          viewports: shots,
          persistence: true,
          clientAdminSync: true,
          drawerTabTrap: 20,
          escapeFocusRecovery: true,
          reducedMotion: true,
          storeFailure: true,
          fonts,
          diagnostics,
          exceptions: errors,
        },
        null,
        2,
      ),
    );
    await navigation();
    console.log(
      'PASS compiled UI themes, five widths, persistent client/admin, drawer keyboard, API error and scene shell',
    );
  }
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
