import { assertPortAvailable } from '../scripts/release-lab.mjs';
import { createBrowserDiagnostics } from './lib/browser-runtime.mjs';
import { chromeExecutable } from './lib/browser-runtime.mjs';
// Production-built assets only; offline API fixture explicitly restricted to this test server.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { launchChrome } from './lib/browser-runtime.mjs';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { resolve, extname } from 'node:path';
const dist = resolve('client/dist'),
  folder = resolve('docs/revision/artifacts/bug-fixes-2026-11-01'),
  downloads = resolve('.cache/bug-fixes/downloads');
mkdirSync(folder, { recursive: true });
mkdirSync(downloads, { recursive: true });
const scene = JSON.parse(readFileSync('tests/fixtures/scene2d-legacy.json'));
scene.objects[0].text = 'PRIVATE PROJECT USER A';
const diagnostics = createBrowserDiagnostics();
const userA = { id: 'user-A', name: 'Reviewer A', email: 'a@test.invalid', role: 'admin' },
  userB = { id: 'user-B', name: 'Reviewer B', email: 'b@test.invalid', role: 'admin' };
let unavailable = false;
let currentUser = userA,
  projectGets = 0,
  saved3d,
  postStarted = false,
  expired = false,
  saved2d,
  assetReads = 0;
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  const json = (data) => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(data));
  };
  if (path === '/api/me') {
    if (!currentUser) {
      res.statusCode = 401;
      return json({ error: { message: 'Logged out' } });
    }
    return json(currentUser);
  }
  if (path === '/api/auth/logout') {
    currentUser = null;
    return json({ ok: true });
  }
  if (path === '/api/auth/login') {
    currentUser = userB;
    return json(userB);
  }
  if (path.startsWith('/api/catalog/editor-asset/')) {
    assetReads++;
    return json({
      slug: path.split('/').at(-1),
      title: path.endsWith('/first') ? 'First asset' : 'Second asset',
      type: 'mockup2d',
      modelUrl: path.endsWith('/expiring')
        ? 'http://127.0.0.1:18100/files/mockup.svg?signature=' +
          (expired ? 'sample-v2' : 'sample-v1')
        : scene.objects[1].src,
    });
  }
  if (path.startsWith('/api/catalog/editor-image/')) {
    assetReads++;
    if (unavailable) {
      res.statusCode = 403;
      return json({ error: { message: 'License denied' } });
    }
    res.writeHead(302, {
      location: '/files/mockup.svg?signature=' + (expired ? 'sample-v2' : 'sample-v1'),
      'cache-control': 'no-store',
    });
    res.end();
    return;
  }
  if (path === '/api/catalog/resolve-editor-image') {
    return json({ url: '/api/catalog/editor-image/expiring' });
  }
  if (path === '/files/mockup.svg') {
    if (expired && !req.url.includes('sample-v2')) {
      res.statusCode = 403;
      res.end('Expired');
      return;
    }
    res.setHeader('content-type', 'image/svg+xml');
    res.end(decodeURIComponent(scene.objects[1].src.split(',')[1]));
    return;
  }
  if (path === '/api/projects/saved-2d') return json({ ...saved2d, id: 'saved-2d' });
  if (path === '/api/projects/sample-2d') {
    projectGets++;
    if (currentUser?.id !== 'user-A') {
      res.statusCode = 404;
      return json({ error: { message: 'Not owned' } });
    }
    return json({
      id: 'sample-2d',
      kind: 'scene2d',
      title: 'PRIVATE PROJECT USER A',
      state: scene,
    });
  }
  if (path === '/api/projects' && req.method === 'POST') {
    let body = '';
    for await (const c of req) body += c;
    const payload = JSON.parse(body);
    if (payload.kind === 'scene2d') {
      saved2d = payload;
      return json({ ...saved2d, id: 'saved-2d' });
    }
    saved3d = payload;
    postStarted = true;
    await new Promise((r) => setTimeout(r, 2000));
    return json({ ...saved3d, id: 'saved-3d' });
  }
  if (path === '/api/projects/other-3d')
    return json({ ...saved3d, id: 'other-3d', title: 'OTHER DOCUMENT' });
  if (path === '/api/projects/saved-3d' && req.method === 'PUT') {
    let body = '';
    for await (const c of req) body += c;
    saved3d = { ...saved3d, ...JSON.parse(body) };
    postStarted = true;
    await new Promise((r) => setTimeout(r, 2000));
    return json({ ...saved3d, id: 'saved-3d' });
  }
  if (path === '/api/projects/saved-3d') return json({ ...saved3d, id: 'saved-3d' });
  if (path.startsWith('/api/')) {
    res.statusCode = 401;
    return json({ error: { message: 'Explicit test fixture' } });
  }
  const admin = path.startsWith('/admin/'),
    root = resolve(admin ? (process.env.NESOMN_ADMIN_DIST ?? 'admin/dist') : dist);
  const file = resolve(root, '.' + (admin ? path.slice(6) : path));
  if (!file.startsWith(root)) {
    res.statusCode = 404;
    res.end();
    return;
  }
  const target = extname(path) ? file : resolve(root, 'index.html');
  if (!existsSync(target)) {
    res.statusCode = 404;
    res.end();
    return;
  }
  res.setHeader(
    'content-type',
    {
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.svg': 'image/svg+xml',
      '.woff2': 'font/woff2',
      '.html': 'text/html',
    }[extname(target)] ?? 'application/octet-stream',
  );
  res.end(readFileSync(target));
});
await new Promise((r) => server.listen(18100, '127.0.0.1', r));
let ws,
  chrome,
  session,
  seq = 0;
const pending = new Map(),
  exceptions = [],
  network = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function send(method, params = {}, sid = session) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, ...(sid ? { sessionId: sid } : {}) }));
  });
}
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  });
  if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}
async function wait(e) {
  for (let i = 0; i < 160; i++) {
    if (await evaluate('Boolean(' + e + ')')) return;
    await sleep(100);
  }
  throw Error('Timeout ' + e + ' ' + JSON.stringify({ exceptions, diagnostics }));
}
async function go(path) {
  await send('Page.navigate', { url: 'http://127.0.0.1:18100' + path });
  await sleep(500);
  await wait('document.querySelector("#root")?.children.length>0');
}
async function click(text) {
  await wait(
    '[...document.querySelectorAll("button")].some(b=>b.textContent.trim()===' +
      JSON.stringify(text) +
      ')',
  );
  await evaluate(
    '(()=>{const b=[...document.querySelectorAll("button")].find(b=>b.textContent.trim()===' +
      JSON.stringify(text) +
      ');if(!b)throw Error("Missing button");b.click();})()',
  );
}
await assertPortAvailable(9250);
try {
  chrome = launchChrome(
    chromeExecutable(),
    [
      '--headless=new',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--no-first-run',
      '--no-default-browser-check',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--remote-debugging-port=9250',
      '--user-data-dir=' + resolve('.cache/bug-fixes' + '/browser-profile'),
    ],
    { windowsHide: true, stdio: 'ignore' },
  );
  let version;
  for (let i = 0; i < 60; i++) {
    try {
      version = await (await fetch('http://127.0.0.1:9250/json/version')).json();
      break;
    } catch {
      await sleep(100);
    }
  }
  assert.ok(version?.webSocketDebuggerUrl, chrome.startupDiagnostics());
  ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  ws.addEventListener('message', (event) => {
    const d = JSON.parse(event.data);
    diagnostics.capture(d);
    if (d.id) {
      const p = pending.get(d.id);
      pending.delete(d.id);
      if (p) {
        if (d.error) p.reject(Error(d.error.message));
        else p.resolve(d.result);
      }
    }
    if (d.method === 'Runtime.exceptionThrown')
      exceptions.push(
        d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text,
      );
    if (d.method === 'Network.requestWillBeSent' && d.params.request.url.startsWith('http'))
      network.push(new URL(d.params.request.url).origin);
  });
  const target = await send('Target.createTarget', { url: 'about:blank' }, null);
  session = (
    await send('Target.attachToTarget', { targetId: target.targetId, flatten: true }, null)
  ).sessionId;
  await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: 'localStorage.setItem("nesomn-theme","light");',
  });
  await send('Page.bringToFront');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads }, null);
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });

  const results = {
    fixture:
      'Fresh production client build (Windows), isolated API double, no production data or Docker',
  };
  async function spa(path) {
    await evaluate(
      'history.pushState({}, "", ' +
        JSON.stringify(path) +
        ');window.dispatchEvent(new PopStateEvent("popstate"));',
    );
    await sleep(500);
  }
  async function input(selector, value) {
    await evaluate(
      '(()=>{const e=document.querySelector(' +
        JSON.stringify(selector) +
        ');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(e,' +
        JSON.stringify(value) +
        ');e.dispatchEvent(new Event("input",{bubbles:true}));})()',
    );
  }
  async function shot(name) {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(folder + '/' + name + '.png', Buffer.from(r.data, 'base64'));
  }
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await go('/editor/scene/first');
  await wait('document.querySelector("#project-title")?.value==="First asset"');
  await wait('document.querySelectorAll("section[aria-label] li").length===1');
  await spa('/editor/scene/second');
  await wait('document.querySelector("#project-title")?.value==="Second asset"');
  const layers = await evaluate('document.querySelectorAll("section[aria-label] li").length');
  assert.equal(layers, 1);
  results.slugSwitch = {
    firstLayers: 1,
    secondLayers: layers,
    bug: false,
    reason: 'Path transition remounts editor and resets state',
  };
  await shot('2d-slug-stack');
  await go('/editor/scene?project=sample-2d');
  await wait('document.querySelector("#project-title")?.value==="PRIVATE PROJECT USER A"');
  await sleep(500);
  const box = await evaluate(
    '(()=>{const r=document.querySelector("#sidebar-user-menu").getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()',
  );
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    ...box,
    button: 'left',
    clickCount: 1,
  });
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    ...box,
    button: 'left',
    clickCount: 1,
  });
  await wait(
    '[...document.querySelectorAll("[role=menuitem]")].some(e=>e.textContent.trim()==="Logout")',
  );
  await evaluate(
    '[...document.querySelectorAll("[role=menuitem]")].find(e=>e.textContent.trim()==="Logout").click()',
  );
  await sleep(500);
  assert.equal(currentUser, null);
  await spa('/login?returnTo=' + encodeURIComponent('/editor/scene?project=sample-2d'));
  await wait('document.querySelector("input[name=email]")');
  await input('input[name=email]', 'b@test.invalid');
  await input('input[name=password]', 'sample-only-password');
  await evaluate('document.querySelector("button[type=submit]").click()');
  await wait(
    'location.pathname==="/editor/scene"&&document.querySelector("#sidebar-user-menu")?.textContent.includes("Reviewer B")',
  );
  await sleep(500);
  const leaked = await evaluate('document.querySelector("#project-title").value');
  const getsBeforeProbe = projectGets;
  const probe = await evaluate('fetch("/api/projects/sample-2d").then(r=>r.status)');
  assert.notEqual(leaked, 'PRIVATE PROJECT USER A');
  assert.ok(getsBeforeProbe >= 2);
  await wait('document.querySelector("[role=alert]")?.textContent.includes("Not owned")');
  assert.equal(probe, 404);
  results.accountSwitch = {
    currentUser: currentUser.id,
    visibleTitle: leaked,
    projectGetsBeforeProbe: getsBeforeProbe,
    serverOwnershipStatus: probe,
  };
  await shot('account-switch-private-project');

  const orangeExpression =
    '(()=>{const c=document.querySelector(".konvajs-content canvas");if(!c)return 0;const d=c.getContext("2d").getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]>200&&d[i+1]>60&&d[i+1]<160&&d[i+2]<60&&d[i+3]>200)n++;return n;})()';
  await go('/editor/scene/expiring');
  await wait('document.querySelector("#project-title")?.value==="Second asset"');
  await wait(orangeExpression + '>0');
  const pixelsBefore = await evaluate(orangeExpression);
  await evaluate('document.querySelector("#editor-save").click()');
  await wait('location.search.includes("saved-2d")');
  assert.equal(saved2d.state.objects[0].src, '/api/catalog/editor-image/expiring');
  expired = true;
  const assetReadsBefore = assetReads;
  await go('/editor/scene?project=saved-2d');
  await wait('document.querySelector(".konvajs-content canvas")');
  await sleep(800);
  await wait(orangeExpression + '>0');
  const pixelsAfter = await evaluate(orangeExpression);
  assert.ok(pixelsAfter > 0);
  assert.ok(assetReads > assetReadsBefore);
  results.expired2dImage = {
    pixelsBefore,
    pixelsAfter,
    layerStillSaved: saved2d.state.objects.length,
    reSignedLookups: assetReads - assetReadsBefore,
    simulatedExpiry: true,
  };
  await shot('2d-signed-source-expired');
  await go('/editor/3d');
  await wait('document.querySelector(".editor3d-canvas canvas")');
  await sleep(800);
  await click('Save');
  for (let i = 0; i < 20 && !postStarted; i++) await sleep(50);
  assert.ok(postStarted);
  await input('#project-title-3d', 'EDITED WHILE SAVING');
  assert.equal(
    await evaluate('document.querySelector("#project-title-3d").value'),
    'EDITED WHILE SAVING',
  );
  await wait('location.search.includes("saved-3d")');
  await sleep(600);
  const after = await evaluate('document.querySelector("#project-title-3d").value');
  assert.equal(after, 'EDITED WHILE SAVING');
  results.save3d = {
    sentTitle: saved3d.title,
    typedWhilePending: 'EDITED WHILE SAVING',
    afterResponse: after,
  };
  await shot('3d-save-preserved');
  postStarted = false;
  await click('Save');
  for (let i = 0; i < 30 && !postStarted; i++) await sleep(50);
  assert.ok(postStarted);
  await input('#project-title-3d', 'UPDATE WHILE SAVING');
  await wait(
    '[...document.querySelectorAll("button")].some(b=>b.textContent.trim()==="Save"&&!b.disabled)',
  );
  assert.equal(
    await evaluate('document.querySelector("#project-title-3d").value'),
    'UPDATE WHILE SAVING',
  );
  assert.ok(
    await evaluate(
      'document.querySelector(".editor3d-inspector [role=status]")?.textContent.includes("belum tersimpan")',
    ),
  );
  results.update3d = { preserved: true };
  postStarted = false;
  await click('Save');
  for (let i = 0; i < 30 && !postStarted; i++) await sleep(50);
  await spa('/editor/3d?project=other-3d');
  await sleep(2500);
  assert.ok(await evaluate('location.search.includes("other-3d")'));
  assert.notEqual(
    await evaluate('document.querySelector("#project-title-3d").value'),
    'UPDATE WHILE SAVING',
  );
  results.staleSave = { ignoredAfterNavigation: true };

  saved2d.state.objects[0].src = '/files/mockup.svg?exp=1&token=expired&signature=sample-v1';
  await go('/editor/scene?project=saved-2d');
  await wait(orangeExpression + '>0');
  results.legacyImage = { recovered: true };
  await shot('legacy-image-recovered');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await sleep(500);
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
  await shot('2d-mobile');
  unavailable = true;
  await go('/editor/scene?project=saved-2d');
  await wait('document.querySelector("[role=alert]")?.textContent.includes("gambar gagal")');
  const beforeDownloads = readdirSync(downloads).length;
  const exportBox = await evaluate(
    '(()=>{const r=document.querySelector("#editor-export").getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()',
  );
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    ...exportBox,
    button: 'left',
    clickCount: 1,
  });
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    ...exportBox,
    button: 'left',
    clickCount: 1,
  });
  await wait('[...document.querySelectorAll("[role=menuitem]")].some(e=>e.textContent==="PNG")');
  await evaluate(
    '[...document.querySelectorAll("[role=menuitem]")].find(e=>e.textContent==="PNG").click()',
  );
  await sleep(300);
  assert.equal(readdirSync(downloads).length, beforeDownloads);
  await shot('2d-image-error-mobile');
  unavailable = false;
  await click('Coba lagi gambar');
  await wait(orangeExpression + '>0');
  results.imageError = { visible: true, exportBlocked: true, retryRecovered: true };
  await evaluate(
    '(()=>{const control=document.querySelector(\'[aria-label="Tema tampilan"]\');control.value="dark";control.dispatchEvent(new Event("change",{bubbles:true}));})()',
  );
  await wait('document.documentElement.dataset.theme === "dark"');
  await shot('2d-mobile-dark');
  assert.deepEqual(exceptions, []);
  results.consoleExceptions = exceptions;

  writeFileSync(folder + '/browser-results.json', JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally {
  if (ws?.readyState === 1) {
    try {
      await send('Browser.close', {}, null);
    } catch {
      /* closed */
    }
    ws.close();
  }
  chrome?.kill();
  await new Promise((r) => server.close(r));
}
