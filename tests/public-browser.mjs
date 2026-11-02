import { createBrowserDiagnostics } from './lib/browser-runtime.mjs';
import {
  chromeExecutable,
  artifactDirectory,
  cacheDirectory,
  labBase,
  labApp,
  fixtureBun,
} from './lib/browser-runtime.mjs';
// Disposable production gateway only; no merchant network requests.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { resolve, dirname, delimiter } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID, createHmac } from 'node:crypto';
import { createTestInvocation } from '../scripts/test-baseline.mjs';
if (process.env.NESOMN_DISPOSABLE_TESTS !== '1') throw Error('Disposable opt-in');
const base = labBase('http://127.0.0.1:18087'),
  folder = artifactDirectory('public', 'docs/revision/artifacts/phase-7'),
  run = randomUUID();
mkdirSync(folder, { recursive: true });
const bun = fixtureBun(),
  env = createTestInvocation('unit', process.env).env;
for (const k of Object.keys(env)) if (k.toLowerCase() === 'path') delete env[k];
env.PATH = dirname(bun) + delimiter + process.env.PATH;
env.NESOMN_DISPOSABLE_TESTS = '1';
function fixture(action, user = '') {
  const r = spawnSync(
    bun,
    ['--no-env-file', '--no-install', 'tests/public-fixture.ts', action, run, user],
    { env, encoding: 'utf8', windowsHide: true, timeout: 20000 },
  );
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}
const asset = fixture('prepare');
function storage(remove = false) {
  const path = '/data/storage/' + asset.fileKey;
  assert.ok(path.startsWith('/data/storage/assets/phase7-demo-'));
  const r = spawnSync(
    'docker',
    [
      'exec',
      labApp('nesomn-revision-phase7-app-1'),
      'bun',
      '--no-env-file',
      '-e',
      remove
        ? 'await Bun.file(' + JSON.stringify(path) + ').delete()'
        : 'await Bun.write(' + JSON.stringify(path) + ',"Demo / Sample download only")',
    ],
    { encoding: 'utf8', windowsHide: true },
  );
  assert.equal(r.status, 0, r.stderr);
}
const diagnostics = createBrowserDiagnostics();
let userId,
  ws,
  chrome,
  session,
  seq = 0;
const pending = new Map(),
  exceptions = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function send(method, params = {}, sid = session) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, ...(sid ? { sessionId: sid } : {}) }));
  });
}
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}
async function wait(expression) {
  for (let i = 0; i < 120; i++) {
    if (await evaluate('Boolean(' + expression + ')')) return;
    await sleep(100);
  }
  throw Error('Timeout ' + expression);
}
async function go(path) {
  await send('Page.navigate', { url: base + path });
  await sleep(300);
  await wait(
    'document.querySelector("#root")?.children.length>0&&document.readyState==="complete"',
  );
  await sleep(400);
}
async function click(text) {
  await evaluate(
    '(()=>{const b=[...document.querySelectorAll("button,a")].find(b=>b.textContent.trim()===' +
      JSON.stringify(text) +
      '&&b.getBoundingClientRect().height>0);if(!b)throw Error("Missing button");b.click();})()',
  );
}
async function theme(mode) {
  await evaluate(
    '(()=>{const s=[...document.querySelectorAll("select")].find(s=>s.getBoundingClientRect().height>0);s.value=' +
      JSON.stringify(mode) +
      ';s.dispatchEvent(new Event("change",{bubbles:true}));})()',
  );
  await wait('document.documentElement.dataset.theme===' + JSON.stringify(mode));
}
async function capture(name, width) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: width < 600,
  });
  await sleep(250);
  const m = await evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth})');
  assert.ok(m.scroll <= m.width, name + ' overflow ' + JSON.stringify(m));
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(folder + '/' + name + '.png', Buffer.from(r.data, 'base64'));
  return m;
}
async function input(name, value) {
  await evaluate(
    '(()=>{const el=document.querySelector("input[name=' +
      name +
      ']");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(el,' +
      JSON.stringify(value) +
      ');el.dispatchEvent(new Event("input",{bubbles:true}));})()',
  );
}
async function api(path, init) {
  return evaluate(
    'fetch(' +
      JSON.stringify('/api' + path) +
      ',' +
      JSON.stringify(init ?? {}) +
      ').then(async r=>({status:r.status,body:await r.json()}))',
  );
}
try {
  storage();
  chrome = spawn(
    chromeExecutable(),
    [
      '--headless=new',
      '--no-first-run',
      '--no-default-browser-check',
      '--remote-debugging-port=9237',
      '--user-data-dir=' +
        resolve(cacheDirectory('public', '.cache/revision-phase-7') + '/browser-profile-' + run),
    ],
    { windowsHide: true, stdio: 'ignore' },
  );
  let version;
  for (let i = 0; i < 60; i++) {
    try {
      version = await (await fetch('http://127.0.0.1:9237/json/version')).json();
      break;
    } catch {
      await sleep(100);
    }
  }
  assert.ok(version?.webSocketDebuggerUrl);
  ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  ws.addEventListener('message', (e) => {
    const d = JSON.parse(e.data);
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
  });
  const target = await send('Target.createTarget', { url: 'about:blank' }, null);
  session = (
    await send('Target.attachToTarget', { targetId: target.targetId, flatten: true }, null)
  ).sessionId;
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  await go('/');
  await wait('document.querySelector(".asset-card")');
  const measurements = [];
  for (const mode of ['light', 'dark']) {
    await theme(mode);
    for (const width of [360, 390, 768, 1024, 1440])
      measurements.push({
        route: 'home',
        mode,
        ...(await capture('home-' + mode + '-' + width, width)),
      });
  }
  await go('/marketplace');
  await wait('document.querySelector(".asset-card")');
  await capture('store-dark-1440', 1440);
  await go('/marketplace/' + asset.slug);
  await wait('document.querySelector(".asset-details")');
  await capture('asset-dark-390', 390);
  await click('Tambah ke bundle');
  await go('/bundle-builder');
  await wait('document.body.innerText.includes("Login untuk melihat harga")');
  await capture('bundle-anonymous-390', 390);
  await click('Login');
  await wait('document.querySelector("input[name=email]")');
  await capture('login-dark-390', 390);
  await click('Daftar');
  await wait('document.querySelector("input[name=name]")');
  await input('name', 'Demo / Sample creator');
  await input('email', 'phase7-' + run + '@test.invalid');
  await input('password', 'Synthetic-phase7-password-only');
  await click('Buat akun');
  await wait(
    'location.pathname==="/bundle-builder"&&document.body.innerText.includes("Lanjut ke checkout")',
  );
  const me = await api('/me');
  assert.equal(me.status, 200);
  userId = me.body.id;
  await capture('bundle-authenticated-1440', 1440);
  await click('Lanjut ke checkout');
  await wait('location.pathname==="/checkout"&&document.body.innerText.includes("Kode unik")');
  const orderId = await evaluate('new URLSearchParams(location.search).get("order")');
  const invoice = await api('/billing/orders/' + orderId);
  assert.equal(invoice.body.baseIdr, 100);
  assert.equal(invoice.body.status, 'pending');
  assert.equal(invoice.body.payableIdr, 100 + invoice.body.code);
  await capture('invoice-before-qr-390', 390);
  await evaluate(
    '[...document.querySelectorAll("button")].find(b=>b.textContent.includes("Tampilkan QRIS")).click()',
  );
  await wait('[...document.images].some(i=>i.src.includes("/qr")&&i.complete&&i.naturalWidth>0)');
  await capture('invoice-qr-390', 390);
  const raw = JSON.stringify({
    reference: 'phase7-' + run,
    merchantId: '99100005',
    storeId: '1',
    amountIdr: invoice.body.payableIdr,
    createdAt: Math.ceil(Date.now() / 1000),
    status: 3,
    completed: true,
  });
  const stamp = String(Math.floor(Date.now() / 1000)),
    signature = createHmac('sha256', 'synthetic-qris-acceptance-secret-never-production')
      .update('nesomn-qris-v1\n' + stamp + '\n' + raw)
      .digest('hex');
  for (let i = 0; i < 2; i++) {
    const r = await fetch(base + '/api/billing/qris/receipts', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-qris-timestamp': stamp,
        'x-qris-signature': signature,
      },
      body: raw,
    });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).outcome, 'applied');
  }
  await wait('document.body.innerText.includes("Pembayaran terverifikasi")');
  await capture('invoice-paid-390', 390);
  await go('/library');
  await wait('document.body.innerText.includes("Demo / Sample — Nesomn asset")');
  await capture('library-dark-390', 390);
  await click('Siapkan download');
  await wait('document.querySelector("a[target=_blank]")');
  const download = await evaluate('document.querySelector("a[target=_blank]").href');
  const payload = await evaluate('fetch(' + JSON.stringify(download) + ').then(r=>r.text())');
  assert.equal(payload, 'Demo / Sample download only');
  const owned = await api('/store/library');
  assert.equal(owned.body.filter((x) => x.id === asset.id).length, 1);
  await go('/account');
  await wait('document.body.innerText.includes("Riwayat pembayaran")');
  await capture('account-dark-390', 390);
  await theme('light');
  await capture('account-light-1440', 1440);
  await go('/editor/projects');
  await wait('document.body.innerText.includes("Belum ada project")');
  await capture('projects-light-390', 390);
  // Revoke current session in UI, log in again and simulate a failed Library request.
  await go('/account');
  await wait('document.body.innerText.includes("Keluar sesi ini")');
  await click('Keluar sesi ini');
  await wait('location.pathname==="/login"');
  await go('/login?returnTo=/library');
  await send('Network.setBlockedURLs', { urls: [base + '/api/store/library*'] });
  await input('email', 'phase7-' + run + '@test.invalid');
  await input('password', 'Synthetic-phase7-password-only');
  await click('Login');
  await wait('document.body.innerText.includes("Library tidak dapat dimuat")');
  await capture('library-offline-390', 390);
  await send('Network.setBlockedURLs', { urls: [] });
  await click('Coba lagi');
  await wait('document.body.innerText.includes("Demo / Sample — Nesomn asset")');
  assert.deepEqual(exceptions, []);
  writeFileSync(
    folder + '/browser.json',
    JSON.stringify(
      {
        fixture:
          'Demo / Sample, fixed disposable database + actual production gateway; synthetic receipt only',
        browser: version.Browser,
        measurements,
        registration: true,
        returnToBundle: true,
        serverBaseIdr: 100,
        uniqueCode: invoice.body.code,
        paidOnlyAfterSignedReceipt: true,
        replayEntitlementCount: 1,
        privateDownload: true,
        offlineRetry: true,
        diagnostics,
        exceptions,
      },
      null,
      2,
    ),
  );
  console.log(
    'PASS browse -> register -> server quote -> QRIS -> signed receipt/replay -> Library/private download; offline retry and responsive themes',
  );
} finally {
  if (ws?.readyState === 1) {
    try {
      await send('Browser.close', {}, null);
    } catch {
      /* browser closing */
    }
    ws.close();
  }
  chrome?.kill();
  fixture('cleanup', userId ?? '');
  storage(true);
}
