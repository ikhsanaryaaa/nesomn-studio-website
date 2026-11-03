import { waitChromeReady } from './lib/browser-runtime.mjs';
import { launchChrome } from './lib/browser-runtime.mjs';
import { createBrowserDiagnostics } from './lib/browser-runtime.mjs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromeExecutable, fixtureBun, artifactDirectory } from './lib/browser-runtime.mjs';
if (process.env.NESOMN_DISPOSABLE_TESTS !== '1' || process.env.NESOMN_RELEASE_LAB !== '1')
  throw Error('Disposable release lab required');
const base = 'http://127.0.0.1:18092',
  folder = artifactDirectory('admin', 'docs/revision/artifacts/phase-10/admin'),
  downloads = resolve('.cache/revision-phase-10/admin/downloads');
mkdirSync(folder, { recursive: true });
mkdirSync(downloads, { recursive: true });
const run = crypto.randomUUID();
const registration = await fetch(base + '/api/auth/register', {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: base },
  body: JSON.stringify({
    email: 'release-admin-' + run + '@test.invalid',
    name: 'Sample release admin',
    password: 'Synthetic-only-password-123',
  }),
});
assert.ok(registration.ok);
const user = await registration.json();
const cookie = registration.headers.get('set-cookie').split(';')[0];
function fixture(action) {
  const r = spawnSync(
    fixtureBun(),
    ['--no-env-file', '--no-install', 'tests/release-admin-fixture.ts', action, user.id],
    { env: process.env, encoding: 'utf8', windowsHide: true },
  );
  assert.equal(r.status, 0, r.stderr);
}
fixture('promote');
const diagnostics = createBrowserDiagnostics();
let packId, bundleId, assetId, workId;
async function api(path, method = 'GET', body) {
  return fetch(base + '/api' + path, {
    method,
    headers: { cookie, origin: base, 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
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
  throw Error('Timeout ' + e);
}
async function go(path) {
  await send('Page.navigate', { url: base + path });
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
      '--remote-debugging-port=9241',
      '--user-data-dir=' + resolve('.cache/revision-phase-10/admin' + '/browser-profile'),
    ],
    { windowsHide: true, stdio: 'ignore' },
  );
  const version = await waitChromeReady(chrome, 9241);

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
    if (d.method === 'Runtime.exceptionThrown') exceptions.push(d.params.exceptionDetails.text);
    if (d.method === 'Network.requestWillBeSent' && d.params.request.url.startsWith('http'))
      network.push(new URL(d.params.request.url).origin);
  });
  const target = await send('Target.createTarget', { url: 'about:blank' }, null);
  session = (
    await send('Target.attachToTarget', { targetId: target.targetId, flatten: true }, null)
  ).sessionId;
  await send('Page.enable');
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
  const split = cookie.indexOf('=');
  await send('Network.setCookie', {
    name: cookie.slice(0, split),
    value: cookie.slice(split + 1),
    url: base,
    httpOnly: true,
    secure: true,
  });
  async function input(id, value) {
    await evaluate(
      '(()=>{const e=document.getElementById(' +
        JSON.stringify(id) +
        ');if(!e)throw Error("Missing field");Object.getOwnPropertyDescriptor(e.tagName==="TEXTAREA"?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,"value").set.call(e,' +
        JSON.stringify(String(value)) +
        ');e.dispatchEvent(new Event("input",{bubbles:true}));})()',
    );
  }
  await go('/admin/');
  await wait('location.pathname==="/admin/assets"');
  await go('/admin/credit-packs/create');
  await wait('document.querySelector("#code")');
  await sleep(500);
  for (const [id, value] of [
    ['code', 'release-' + run],
    ['name', 'Demo / Sample release credits'],
    ['credits', '10'],
    ['priceIdr', '100'],
    ['priceUsd', '1'],
  ])
    await input(id, value);
  await click('Save changes');
  await wait('location.pathname==="/admin/credit-packs"');
  const packs = await (await api('/admin/credit-packs')).json();
  const pack = packs.find((p) => p.code === 'release-' + run);
  assert.ok(pack);
  packId = pack.id;
  assert.equal(pack.credits, 10);
  await go('/admin/credit-packs/edit/' + packId);
  await wait('document.querySelector("#credits")?.value==="10"');
  await input('credits', '11');
  await click('Save changes');
  await wait('location.pathname==="/admin/credit-packs"');
  assert.equal((await (await api('/admin/credit-packs/' + packId)).json()).credits, 11);
  const title = 'Demo / Sample bundle asset ' + run;
  const assetResponse = await api('/admin/assets-scene', 'POST', {
    slug: 'release-asset-' + run,
    title,
    type: 'graphic',
    status: 'draft',
  });
  assert.equal(assetResponse.status, 201);
  assetId = (await assetResponse.json()).id;
  await go('/admin/bundles/create');
  await wait('document.querySelector("#slug")');
  await sleep(300);
  await input('title', 'Demo / Sample bundle');
  await input('slug', 'release-bundle-' + run);
  await wait(
    '[...document.querySelectorAll(".admin-multiselect label")].some(e=>e.textContent===' +
      JSON.stringify(title) +
      ')',
  );
  await evaluate(
    '[...document.querySelectorAll(".admin-multiselect label")].find(e=>e.textContent===' +
      JSON.stringify(title) +
      ').click()',
  );
  await click('Save changes');
  await wait('!location.pathname.endsWith("/create")');
  const listedBundles = await (await api('/admin/bundles')).json();
  bundleId = listedBundles.find((b) => b.slug === 'release-bundle-' + run)?.id;
  assert.ok(bundleId);
  assert.deepEqual((await (await api('/admin/bundles/' + bundleId)).json()).assetIds, [assetId]);
  await go('/admin/bundles/edit/' + bundleId);
  await wait('document.querySelector("#title")?.value==="Demo / Sample bundle"');
  await input('title', 'Updated sample bundle');
  await click('Save changes');
  await wait('!location.pathname.includes("/edit/")');
  const editedBundle = await (await api('/admin/bundles/' + bundleId)).json();
  assert.equal(editedBundle.title, 'Updated sample bundle');
  assert.deepEqual(editedBundle.assetIds, [assetId]);
  await go('/admin/credit-packs');

  await go('/admin/works/create');
  await wait('document.querySelector("#work-title")');
  for (const [id, value] of [
    ['work-title', 'Demo / Sample acceptance work'],
    ['work-slug', 'release-work-' + run],
    ['work-description', 'Explicit disposable portfolio acceptance fixture.'],
    ['work-date', '2026-11-03'],
    ['work-link-label', 'Explore sample'],
    ['work-link-url', 'https://shop.nesomn.studio/demo/3d?model=nesomn-studio-kit'],
  ])
    await input(id, value);
  await evaluate('document.querySelector(".works-sample-label button").click()');
  async function upload(id, path) {
    const doc = await send('DOM.getDocument');
    const node = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '#' + id });
    await send('DOM.setFileInputFiles', { nodeId: node.nodeId, files: [resolve(path)] });
    await wait(
      '!document.querySelector("#work-title").disabled && !document.body.textContent.includes("Uploading media. Keep this page open.")',
    );
    await sleep(200);
  }
  await upload('work-cover-upload', 'client/public/demo/portfolio/studio-kit/cover.png');
  await wait('document.querySelector(".works-cover-preview img")?.complete');
  await upload('work-gallery-upload', 'client/public/demo/portfolio/studio-kit/artwork.png');
  await wait('document.querySelectorAll(".works-gallery-item").length===1');
  const altId = await evaluate('document.querySelector(".works-gallery input[id^=work-alt]").id');
  await input(altId, 'Original sample Studio Kit artwork');
  await upload('work-gallery-upload', 'client/public/demo/portfolio/studio-kit/motion.mp4');
  await wait('document.querySelectorAll(".works-gallery-item").length===2');
  await click('Save changes');
  await wait('location.pathname.includes("/admin/works/edit/")');
  workId = await evaluate('location.pathname.split("/").pop()');
  await wait('document.querySelector("#work-title")?.value==="Demo / Sample acceptance work"');
  await evaluate('document.querySelector("#work-status").click()');
  await wait('document.querySelector("[role=option][data-state=unchecked]")');
  await evaluate(
    '[...document.querySelectorAll("[role=option]")].find(e=>e.textContent==="Published").click()',
  );
  await click('Save changes');
  await wait('document.body.textContent.includes("Work published.")');
  const savedWork = await (await api('/admin/works/' + workId)).json();
  assert.equal(savedWork.status, 'published');
  assert.equal(savedWork.gallery.length, 2);
  assert.equal(savedWork.isSample, true);
  const publicWork = await (await fetch(base + '/api/works/release-work-' + run)).json();
  assert.equal(publicWork.title, 'Demo / Sample acceptance work');
  assert.equal((await fetch(base + publicWork.cover.url)).status, 200);
  for (const theme of ['light', 'dark']) {
    await evaluate(
      'localStorage.setItem("nesomn-theme",' +
        JSON.stringify(theme) +
        ');window.dispatchEvent(new Event("storage"));',
    );
    for (const width of [360, 390, 768, 1024, 1440]) {
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height: 1000,
        deviceScaleFactor: 1,
        mobile: width < 600,
      });
      await sleep(200);
      assert.ok(
        await evaluate('document.documentElement.scrollWidth<=innerWidth'),
        'Works admin overflow',
      );
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(
        folder + '/works-' + theme + '-' + width + '.png',
        Buffer.from(shot.data, 'base64'),
      );
    }
  }
  await go('/admin/works');
  await wait(
    'document.querySelector(".rt-TableRoot")?.textContent.includes("Demo / Sample acceptance work")',
  );

  const shots = [];
  for (const theme of ['light', 'dark']) {
    await evaluate(
      'localStorage.setItem("nesomn-theme",' +
        JSON.stringify(theme) +
        ');window.dispatchEvent(new Event("storage"));',
    );
    for (const width of [360, 390, 768, 1024, 1440]) {
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height: 1000,
        deviceScaleFactor: 1,
        mobile: width < 600,
      });
      await sleep(400);
      const m = await evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth})');
      assert.ok(m.scroll <= m.width, 'Admin overflow');
      const image = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(
        folder + '/credit-packs-' + theme + '-' + width + '.png',
        Buffer.from(image.data, 'base64'),
      );
      shots.push({ theme, ...m });
    }
  }
  for (const resource of [
    'users',
    'ai-providers',
    'usage',
    'sessions',
    'audit-logs',
    'subscriptions',
    'credit-ledger',
    'plans',
    'assets-3d',
    'assets',
    'bundles',
  ]) {
    await go('/admin/' + resource);
    await wait('document.querySelector(".rt-TableRoot")');
  }
  assert.deepEqual(exceptions, []);
  assert.ok(network.every((origin) => origin === base));
  writeFileSync(
    folder + '/browser.json',
    JSON.stringify(
      {
        browser: version.Browser,
        realDockerApi: true,
        defaultRedirect: true,
        creditPackCreateEdit: true,
        bundleMembershipCreateEdit: true,
        resourceLists: true,
        portfolioCreatePublishMixedMedia: true,
        shots,
        diagnostics,
        exceptions,
      },
      null,
      2,
    ),
  );
  console.log('PASS actual admin create/edit, lists, 5 widths x 2 themes');
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
  if (workId) await api('/admin/works/' + workId, 'DELETE');
  if (bundleId) await api('/admin/bundles/' + bundleId, 'DELETE');
  if (assetId) await api('/admin/assets-scene/' + assetId, 'DELETE');
  if (packId) await api('/admin/credit-packs/' + packId, 'DELETE');
  fixture('cleanup');
}
