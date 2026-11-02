import { createBrowserDiagnostics } from './lib/browser-runtime.mjs';
import {
  chromeExecutable,
  artifactDirectory,
  cacheDirectory,
  labBase,
} from './lib/browser-runtime.mjs';
// Actual production gateway + disposable database only. No offline API fixtures.
import assert from 'node:assert/strict';
import { launchChrome } from './lib/browser-runtime.mjs';
import { resolve } from 'node:path';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
if (process.env.NESOMN_DISPOSABLE_TESTS !== '1') throw Error('Disposable opt-in required');
const folder = artifactDirectory('editor-gateway', 'docs/revision/artifacts/phase-9'),
  downloads = resolve(
    cacheDirectory('editor-gateway', '.cache/revision-phase-9') + '/gateway-downloads',
  );
mkdirSync(downloads, { recursive: true });
const base = labBase('http://127.0.0.1:18091'),
  scene = JSON.parse(readFileSync('tests/fixtures/scene2d-legacy.json'));
async function register() {
  const r = await fetch(base + '/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: base },
    body: JSON.stringify({
      email: crypto.randomUUID() + '@test.invalid',
      name: 'Sample phase9',
      password: 'Synthetic-test-only-123',
    }),
  });
  assert.ok(r.ok, await r.clone().text());
  return r.headers.get('set-cookie').split(';')[0];
}
const cookie = await register();
async function api(path, method = 'GET', body, auth = cookie) {
  return fetch(base + '/api' + path, {
    method,
    headers: { cookie: auth, 'content-type': 'application/json', origin: base },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
const created = await api('/projects', 'POST', {
  title: 'Sample gateway scene',
  kind: 'scene2d',
  state: scene,
});
assert.ok(created.ok);
const project = await created.json();
const diagnostics = createBrowserDiagnostics();
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
  await send('Page.navigate', { url: labBase('http://127.0.0.1:18091') + path });
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
      '--remote-debugging-port=9240',
      '--user-data-dir=' +
        resolve(cacheDirectory('editor-gateway', '.cache/revision-phase-9') + '/browser-profile'),
    ],
    { windowsHide: true, stdio: 'ignore' },
  );
  let version;
  for (let i = 0; i < 60; i++) {
    try {
      version = await (await fetch('http://127.0.0.1:9240/json/version')).json();
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
  await go('/editor/scene?project=' + project.id);
  await wait('document.querySelector(".konvajs-content canvas")');
  await sleep(800);
  await click('Save');
  await wait('document.body.innerText.includes("Tersimpan")');
  assert.deepEqual((await (await api('/projects/' + project.id)).json()).state, scene);
  await click('Add Text');
  await click('Save');
  await sleep(500);
  assert.equal((await (await api('/projects/' + project.id)).json()).state.objects.length, 3);
  await evaluate('document.querySelector("#editor-undo").click()');
  await click('Save');
  await sleep(500);
  assert.deepEqual((await (await api('/projects/' + project.id)).json()).state, scene);
  const foreign = await register();
  assert.equal((await api('/projects/' + project.id, 'GET', undefined, foreign)).status, 404);
  for (const path of ['/admin/subscriptions', '/admin/credit-ledger'])
    assert.equal((await api(path)).status, 403);
  await go('/editor/scene');
  await wait('document.querySelector(".konvajs-content canvas")');
  await click('Add Text');
  await click('Save');
  await wait('location.search.includes("project=")');
  await sleep(700);
  const search = await evaluate('location.search');
  const newId = new URLSearchParams(search).get('project');
  const persisted = await (await api('/projects/' + newId)).json();
  assert.equal(persisted.kind, 'scene2d');
  assert.equal(persisted.state.objects.length, 1);
  assert.equal(await evaluate('document.querySelectorAll("[aria-pressed=true]").length'), 1);
  await api('/projects/' + newId, 'DELETE');
  assert.deepEqual(exceptions, []);
  writeFileSync(
    folder + '/gateway-browser.json',
    JSON.stringify(
      {
        browser: version.Browser,
        productionDockerGateway: base,
        realAuth: true,
        legacyRoundtrip: true,
        newProject: true,
        duplicateSave: false,
        addUndo: true,
        ownership404: true,
        regularAdmin403: true,
        diagnostics,
        exceptions,
      },
      null,
      2,
    ),
  );
  console.log(
    'PASS real Docker gateway auth/legacy/new project/add/undo/save/ownership/admin role',
  );
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
  await api('/projects/' + project.id, 'DELETE');
}
