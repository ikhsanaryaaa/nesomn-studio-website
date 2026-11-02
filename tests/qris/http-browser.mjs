import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { resolve, dirname, delimiter } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createTestInvocation } from '../../scripts/test-baseline.mjs';
if (process.env.NESOMN_DISPOSABLE_TESTS !== '1') throw new Error('Disposable opt-in required');
const base = 'http://127.0.0.1:18085',
  folder = 'docs/revision/artifacts/phase-5';
mkdirSync(folder, { recursive: true });
mkdirSync('.cache/revision-phase-5/spool', { recursive: true });
const env = createTestInvocation('unit', process.env).env;
for (const k of Object.keys(env)) if (k.toLowerCase() === 'path') delete env[k];
const bun = resolve('.cache/runtime/bun-1.4.4/bun-windows-x64/bun.exe');
env.PATH = dirname(bun) + delimiter + process.env.PATH;
env.NESOMN_DISPOSABLE_TESTS = '1';
function fixture(action, id, pack = '') {
  const r = spawnSync(
    bun,
    ['--no-env-file', '--no-install', 'tests/qris/http-fixture.ts', action, id, pack],
    { env, encoding: 'utf8', windowsHide: true, timeout: 20000 },
  );
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}
let userId, packId, chrome, ws;
const pending = new Map();
let seq = 0,
  session;
function send(method, params = {}, sid = session) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, ...(sid ? { sessionId: sid } : {}) }));
  });
}
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('Browser evaluation failed');
  return r.result.value;
}
async function wait(expression) {
  for (let i = 0; i < 80; i++) {
    if (await evaluate(expression)) return;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error('Browser state timed out');
}
async function capture(name, width, height) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 600,
  });
  await new Promise((r) => setTimeout(r, 250));
  const metrics = await evaluate(
    '({width:innerWidth,scroll:document.documentElement.scrollWidth})',
  );
  assert.ok(metrics.scroll <= metrics.width, JSON.stringify(metrics));
  const layout = await send('Page.getLayoutMetrics');
  const shot = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width, height: Math.ceil(layout.cssContentSize.height), scale: 1 },
  });
  writeFileSync(folder + '/' + name + '.png', Buffer.from(shot.data, 'base64'));
  return metrics;
}
try {
  const registration = await fetch(base + '/api/auth/register', {
    method: 'POST',
    headers: { origin: base, 'content-type': 'application/json' },
    body: JSON.stringify({
      email: 'phase5-http-' + randomUUID() + '@test.invalid',
      password: 'Synthetic-test-password-only',
      name: 'Demo / Sample checkout',
    }),
  });
  assert.equal(registration.status, 201);
  userId = (await registration.json()).id;
  const cookie = registration.headers.get('set-cookie').split(';')[0];
  packId = fixture('prepare', userId).packId;
  const checkout = await fetch(base + '/api/billing/checkout', {
    method: 'POST',
    headers: {
      origin: base,
      cookie,
      'content-type': 'application/json',
      'idempotency-key': randomUUID(),
    },
    body: JSON.stringify({
      type: 'topup',
      gateway: 'qris',
      creditPackId: packId,
      amountIdr: 1,
      status: 'paid',
    }),
  });
  assert.equal(checkout.status, 200);
  const order = (await checkout.json()).order;
  const invoice = await (
    await fetch(base + '/api/billing/orders/' + order.id, { headers: { cookie } })
  ).json();
  assert.equal(invoice.baseIdr, 100);
  assert.equal(invoice.status, 'pending');
  assert.equal(invoice.payableIdr, 100 + invoice.code);
  assert.equal(
    (await fetch(base + '/api/billing/qris/receipts', { method: 'POST', body: '{}' })).status,
    401,
  );
  chrome = spawn(
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    [
      '--headless=new',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--disable-sync',
      '--no-proxy-server',
      '--remote-debugging-port=9235',
      '--user-data-dir=' + resolve('.cache/revision-phase-5/chrome-profile'),
      'about:blank',
    ],
    { windowsHide: true, stdio: 'ignore' },
  );
  let version;
  for (let i = 0; i < 40; i++) {
    try {
      version = await (await fetch('http://127.0.0.1:9235/json/version')).json();
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  assert.ok(version?.webSocketDebuggerUrl);
  ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  ws.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    if (data.id) {
      const p = pending.get(data.id);
      pending.delete(data.id);
      if (p) {
        if (data.error) p.reject(new Error(data.error.message));
        else p.resolve(data.result);
      }
    }
  });
  const target = await send('Target.createTarget', { url: 'about:blank' }, null);
  session = (
    await send('Target.attachToTarget', { targetId: target.targetId, flatten: true }, null)
  ).sessionId;
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  const token = cookie.slice(cookie.indexOf('=') + 1);
  await send('Network.setCookie', {
    name: 'nesomn_session',
    value: token,
    url: base,
    path: '/',
    httpOnly: true,
    secure: false,
    sameSite: 'Lax',
  });
  await send('Page.navigate', { url: base + '/checkout?order=' + order.id });
  await wait('document.body.innerText.includes("Unique payment code")');
  const screenshots = [];
  screenshots.push(await capture('checkout-before-confirm-390', 390, 844));
  await evaluate(
    '[...document.querySelectorAll("button")].find(b=>b.textContent.includes("Show QRIS")).click()',
  );
  await wait('[...document.images].some(i=>i.src.includes("/qr")&&i.complete&&i.naturalWidth>0)');
  screenshots.push(await capture('checkout-qr-390', 390, 844));
  await evaluate(
    '[...document.querySelectorAll("*")].filter(e=>e.scrollHeight>e.clientHeight+10&&/auto|scroll/.test(getComputedStyle(e).overflowY)).forEach(e=>e.scrollTop=e.scrollHeight)',
  );
  await capture('checkout-qr-390-bottom', 390, 844);
  await evaluate('[...document.querySelectorAll("*")].forEach(e=>{if(e.scrollTop)e.scrollTop=0;})');
  screenshots.push(await capture('checkout-qr-1440', 1440, 1000));
  for (const width of [360, 768, 1024])
    screenshots.push(await capture('checkout-qr-' + width, width, 1000));
  const raw = {
    transactionId: 'sample-' + randomUUID(),
    merchantId: '99100005',
    storeId: '1',
    amount: String(invoice.payableIdr),
    createTime: Math.ceil(Date.now() / 1000),
    status: 3,
  };
  function delivery(loseAck) {
    const code = `import json,httpx\nfrom worker import Spool\nfrom qrismerchantid.shopee.transactions import _normalize\nraw=json.loads(${JSON.stringify(JSON.stringify(raw))})\ns=Spool('/data/http-acceptance.sqlite',raw['createTime']-60)\ns.save([_normalize(raw,'1','99100005')],raw['createTime'],'99100005','1')\nwith httpx.Client(timeout=10,trust_env=False) as hook:\n def post(body,headers):\n  response=hook.post('http://nesomn-revision-phase5-app-1:3000/api/billing/qris/receipts',content=body,headers=headers)\n  assert response.status_code==200\n  ${loseAck ? "raise RuntimeError('Synthetic ACK loss after commit')" : 'return response'}\n failed=s.deliver(post,'synthetic-qris-acceptance-secret-never-production')\n assert s.db.execute('SELECT delivered FROM events WHERE id=?',(raw['transactionId'],)).fetchone()[0]==${loseAck ? 0 : 1}\ns.db.close()\nprint('PASS: durable delivery '+str(failed))`;
    const r = spawnSync(
      'docker',
      [
        'run',
        '--rm',
        '--network',
        'nesomn-revision-data-test',
        '--mount',
        `type=bind,source=${resolve('.cache/revision-phase-5/spool')},target=/data`,
        'nesomn-qris-worker:revision-phase5',
        'python',
        '-c',
        code,
      ],
      { env, encoding: 'utf8', windowsHide: true, timeout: 30000 },
    );
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.trim();
  }
  const lost = delivery(true),
    recovered = delivery(false);
  const balance = await (await fetch(base + '/api/ai/credit', { headers: { cookie } })).json();
  assert.equal(balance.balance, 10);
  await wait('document.body.innerText.includes("Payment verified")');
  await capture('checkout-paid-390', 390, 844);
  writeFileSync(
    folder + '/http-browser-worker.json',
    JSON.stringify(
      {
        fixture: 'Demo / Sample only; no merchant calls',
        browser: version.Browser,
        invoicePending: true,
        unsignedReceipt: 401,
        serverPrices: true,
        uniqueCode: invoice.code,
        workerLostAck: lost,
        workerRecovered: recovered,
        finalBalance: balance.balance,
        finalPaid: true,
        screenshots,
      },
      null,
      2,
    ),
  );
  console.log(
    'PASS: production HTTP, Chrome390/1440, SDK normalization->SQLite->HMAC->atomic paid; ACK-loss restart exactly one credit grant',
  );
} finally {
  if (ws?.readyState === 1) {
    try {
      await send('Browser.close', {}, null);
    } catch {
      /* Browser may close without reply. */
    }
    ws.close();
  }
  if (chrome && !chrome.killed) chrome.kill();
  if (userId) fixture('cleanup', userId, packId ?? '');
}
