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
    artifactDirectory('works-public', 'docs/revision/artifacts/works-phase2-2026-11-03'),
);
mkdirSync(folder, { recursive: true });
const mime = {
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.html': 'text/html',
  '.png': 'image/png',
  '.mp4': 'video/mp4',
};
let catalogMode = 'error';
let workMode = 'error';
const fixtureWork = JSON.parse(
  readFileSync('client/public/demo/portfolio/studio-kit/manifest.json', 'utf8'),
);
fixtureWork.status = 'published';
const mediaIds = new Map(),
  mediaPaths = new Map();
function fixtureMedia(m) {
  if (!mediaIds.has(m.id)) mediaIds.set(m.id, crypto.randomUUID());
  const id = mediaIds.get(m.id);
  mediaPaths.set(id, m.url);
  return { ...m, id, url: '/api/works/media/' + id };
}
fixtureWork.cover = fixtureMedia(fixtureWork.cover);
fixtureWork.gallery = fixtureWork.gallery.map((g) => {
  const media = fixtureMedia(g.media),
    poster = g.poster ? fixtureMedia(g.poster) : null;
  return { ...g, mediaId: media.id, posterMediaId: poster?.id ?? null, media, poster };
});
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.headers.origin === 'http://localhost:18116') {
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
  if (url.pathname.startsWith('/api/works') && workMode !== 'error') {
    const id = url.pathname.split('/').at(-1);
    if (mediaPaths.has(id)) {
      res.writeHead(302, { location: mediaPaths.get(id) });
      res.end();
      return;
    }
    res.writeHead(workMode === 'missing' ? 404 : 200, {
      'content-type': 'application/json',
      'x-total-count': workMode === 'empty' ? '0' : '1',
    });
    res.end(
      JSON.stringify(
        workMode === 'missing'
          ? { error: { message: 'Work not found' } }
          : url.pathname === '/api/works'
            ? workMode === 'empty'
              ? []
              : [fixtureWork]
            : fixtureWork,
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
      (process.env.NESOMN_SPLIT_BROWSER === '1' && req.headers.host === 'localhost:18116'),
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
await new Promise((r) => server.listen(18116, '127.0.0.1', r));
const chrome = launchChrome(
  chromeExecutable(),
  [
    '--headless=new',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=9276',
    '--user-data-dir=' +
      resolve(
        cacheDirectory('works-public', '.cache/revision-phase-6/browser-profile') +
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
        ? 'http://localhost:18116' + path.slice(6)
        : 'http://127.0.0.1:18116' +
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
  if(name.startsWith('about-') && width > 700) assert.equal(await evaluate('[...document.querySelectorAll(".marketing-login,.marketing-mobile-login")].filter(e=>e.getBoundingClientRect().height>0).length'),1,'One visible desktop login');
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(resolve(folder, name + '.png'), Buffer.from(r.data, 'base64'));
  return dimensions;
}
try {
  const version = await waitChromeReady(chrome, 9276);

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

  const results = [];
  for (const theme of ['light', 'dark']) {
    await go('/demo/works/nesomn-studio-kit');
    await selectTheme(theme);
    await wait('document.querySelector("h1")?.textContent.includes("Nesomn Studio Kit")');
    for (const width of [360, 390, 768, 1024, 1440])
      results.push({ theme, width, ...(await screenshot('detail-' + theme + '-' + width, width)) });
    await evaluate(
      'document.querySelector(".work-image-open").focus();document.querySelector(".work-image-open").click()',
    );
    await wait('document.querySelector("[role=dialog]")');
    await send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'Escape',
      code: 'Escape',
      windowsVirtualKeyCode: 27,
    });
    await wait('!document.querySelector("[role=dialog]")');
    await wait('document.activeElement?.classList.contains("work-image-open")');
  }
  await evaluate('document.querySelector("video")?.scrollIntoView()');
  await wait('document.querySelector("video")?.readyState>=1');
  const duration = await evaluate('document.querySelector("video").duration');
  assert.ok(duration >= 3);
  await go('/works');
  await wait('document.body.textContent.includes("Unable to load works")');
  assert.equal(await evaluate('!!document.querySelector(".works-card")'), false);
  await screenshot('works-api-error-1440', 1440);
  workMode = 'success';
  await go('/works');
  await wait('document.querySelector(".works-card")');
  for (const theme of ['light','dark']) {
    await selectTheme(theme);
    for (const width of [360,390,768,1024,1440]) await screenshot('works-list-'+theme+'-'+width,width);
  }
  await go('/works/nesomn-studio-kit');
  await wait('document.querySelector("h1")?.textContent.includes("Nesomn Studio Kit")');
  workMode = 'missing';
  await go('/works/missing');
  await wait('document.body.textContent.toLowerCase().includes("not found")');
  workMode = 'empty';
  await go('/works');
  await wait(
    '!document.querySelector(".works-card")&&!document.body.textContent.includes("Loading works")',
  );
  for(const theme of ['light','dark']){
    await go('/about');await selectTheme(theme);
    await wait('document.querySelector("#contact")');
    const intro=await evaluate('(()=>{const s=getComputedStyle(document.querySelector(".about-introduction p:first-child"));return {font:s.fontFamily,weight:s.fontWeight}})()');
    assert.match(intro.font,/Poppins/);assert.equal(intro.weight,'700');
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:1000,deviceScaleFactor:1,mobile:true});
    await evaluate('document.querySelector(".marketing-menu-toggle").click()');
    await wait('document.querySelector(".marketing-menu-toggle").getAttribute("aria-expanded")==="true"');
    assert.ok(await evaluate('document.querySelector("#marketing-navigation .marketing-mobile-login").getBoundingClientRect().height>=44'));
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await wait('document.activeElement===document.querySelector(".marketing-menu-toggle")');
    for(const width of [360,390,768,1024,1440])await screenshot('about-'+theme+'-'+width,width);
    for(const href of ['mailto:contact@nesomn.studio','mailto:nesomnstudio@gmail.com','https://wa.me/6285183159776','https://instagram.com/nesomnstudio','https://t.me/nesomnstudio'])assert.ok(await evaluate('!!document.querySelector('+JSON.stringify('a[href="'+href+'"]')+')'));
  }
  assert.deepEqual(errors, []);
  writeFileSync(
    resolve(folder, 'browser.json'),
    JSON.stringify(
      { results, duration, lightbox: true, focusRecovery: true, noMockOnError: true, errors },
      null,
      2,
    ),
  );
  console.log(
    'PASS Works sample5widths2themes, lightbox/focus, native video metadata and honest API failure',
  );
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
