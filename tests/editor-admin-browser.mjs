import { waitChromeReady } from './lib/browser-runtime.mjs';
import { createBrowserDiagnostics } from './lib/browser-runtime.mjs';
import { chromeExecutable, artifactDirectory, cacheDirectory } from './lib/browser-runtime.mjs';
// Production-built assets only; offline API fixture explicitly restricted to this test server.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { launchChrome } from './lib/browser-runtime.mjs';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { resolve, extname } from 'node:path';
const dist = resolve(process.env.NESOMN_VIEWER_DIST ?? 'client/dist'),
  folder = artifactDirectory('editor-admin', 'docs/revision/artifacts/phase-9'),
  downloads = resolve(
    cacheDirectory('editor-admin', '.cache/revision-phase-9') + '/downloads/run-' + Date.now(),
  );
mkdirSync(folder, { recursive: true });
mkdirSync(downloads, { recursive: true });
const scene = JSON.parse(readFileSync('tests/fixtures/scene2d-legacy.json'));
const diagnostics = createBrowserDiagnostics();
let saved,
  jobStatus = 'pending',
  jobReads = 0,
  creates = 0,
  cancellations = 0,
  creditError = false;
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  const json = (data) => {
    res.setHeader('content-type', 'application/json');
    res.setHeader('x-total-count', '1');
    res.end(JSON.stringify(data));
  };
  if (path === '/api/me')
    return json({
      id: 'sample-user',
      name: 'Sample tester',
      email: 'sample@test.invalid',
      role: 'admin',
    });
  if (path === '/api/projects/sample-2d') {
    if (req.method === 'PUT') {
      let body = '';
      for await (const chunk of req) body += chunk;
      saved = JSON.parse(body);
    }
    return json({
      id: 'sample-2d',
      title: saved?.title ?? 'Sample legacy scene',
      kind: 'scene2d',
      state: saved?.state ?? scene,
    });
  }
  if (path === '/api/projects/wrong-kind')
    return json({ id: 'wrong-kind', kind: 'scene3d', title: 'Wrong editor', state: {} });
  if (path === '/api/ai/models')
    return json([{ id: 'sample-model', modelName: 'Sample model', creditCost: 3 }]);
  if (path === '/api/ai/credit') {
    if (creditError) {
      res.statusCode = 503;
      return json({ error: { message: 'Fixture credit outage' } });
    }
    return json({ balance: 47 });
  }
  const job = {
    id: 'sample-job',
    tab: 'scene',
    status: jobStatus,
    error: jobStatus === 'failed' ? 'Sample failure' : null,
  };
  if (path === '/api/ai/jobs' && req.method === 'POST') {
    creates++;
    return json(job);
  }
  if (path === '/api/ai/jobs') return json([job]);
  if (path === '/api/ai/jobs/sample-job/cancel') {
    cancellations++;
    jobStatus = 'failed';
    return json({ ...job, status: 'failed' });
  }
  if (path === '/api/ai/jobs/sample-job') {
    jobReads++;
    await new Promise((r) => setTimeout(r, 600));
    return json(job);
  }
  if (path === '/api/admin/subscriptions')
    return json([
      {
        id: 'sample-sub',
        userId: 'sample-user',
        planId: 'sample-plan',
        status: 'canceled',
        gateway: 'manual',
        currentPeriodStart: '2026-10-01',
        currentPeriodEnd: '2026-11-01',
      },
    ]);
  if (path === '/api/admin/credit-ledger')
    return json([
      {
        id: 'sample-entry',
        userId: 'sample-user',
        delta: -3,
        balanceAfter: 47,
        reason: 'charge',
        refId: 'sample-job',
        createdAt: '2026-10-31',
      },
    ]);
  if (path === '/api/admin/assets-scene') return json([]);
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
await new Promise((r) => server.listen(18090, '127.0.0.1', r));
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
  await send('Page.navigate', { url: 'http://127.0.0.1:18090' + path });
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
async function activateTab(text) {
  const box = await evaluate(
    '(()=>{const e=[...document.querySelectorAll("[role=tab]")].find(e=>e.textContent===' +
      JSON.stringify(text) +
      ');const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()',
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
    '[...document.querySelectorAll("[role=tab]")].some(e=>e.textContent===' +
      JSON.stringify(text) +
      '&&e.getAttribute("data-state")==="active")',
  );
}
async function capture(name, width) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: width < 600,
  });
  await sleep(600);
  if (await evaluate('Boolean(document.querySelector(".konvajs-content canvas"))'))
    await wait(
      '(()=>{const c=document.querySelector(".konvajs-content canvas");const d=c.getContext("2d").getImageData(0,0,c.width,c.height).data;for(let i=0;i<d.length;i+=4)if(d[i]>200&&d[i+1]>60&&d[i+1]<160&&d[i+2]<60&&d[i+3]>200)return true;return false;})()',
    );
  const metrics = await evaluate(
    '({width:innerWidth,scroll:document.documentElement.scrollWidth})',
  );
  assert.ok(metrics.scroll <= metrics.width, name + ' overflow');
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(folder + '/' + name + '.png', Buffer.from(r.data, 'base64'));
  return metrics;
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
      '--remote-debugging-port=9239',
      '--user-data-dir=' +
        resolve(
          cacheDirectory('editor-admin', '.cache/revision-phase-9/browser-profile') +
            '/browser-profile',
        ),
    ],
    { windowsHide: true, stdio: 'ignore' },
  );
  const version = await waitChromeReady(chrome, 9239);

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
  await go('/editor/scene?project=sample-2d');
  await wait('document.querySelector(".konvajs-content canvas")');
  await sleep(1000);
  await click('Save');
  await sleep(500);
  assert.deepEqual(saved.state, scene);
  await click('Synthetic legacy fixture');
  await evaluate('document.querySelector("#editor-duplicate").click()');
  await click('Save');
  await sleep(300);
  assert.equal(saved.state.objects.length, 3);
  await evaluate('document.querySelector("#editor-undo").click()');
  await click('Save');
  await sleep(300);
  assert.deepEqual(saved.state, scene);
  await click('Synthetic legacy fixture');
  for (const format of ['PNG', 'JPEG']) {
    await send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: 1,
      y: 1,
      button: 'left',
      clickCount: 1,
    });
    await send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: 1,
      y: 1,
      button: 'left',
      clickCount: 1,
    });
    const exportBox = await evaluate(
      '(()=>{const r=document.querySelector("#editor-export").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()',
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
    await wait(
      '[...document.querySelectorAll("[role=menuitem]")].some(e=>e.textContent===' +
        JSON.stringify(format) +
        ')',
    );
    await evaluate(
      '[...document.querySelectorAll("[role=menuitem]")].find(e=>e.textContent===' +
        JSON.stringify(format) +
        ').click()',
    );
    await sleep(400);
  }
  for (let attempt = 0; attempt < 80; attempt++) {
    if (readdirSync(downloads).filter((n) => /\.(png|jpg)$/.test(n)).length === 2) break;
    await sleep(100);
  }
  const files = readdirSync(downloads).filter((n) => /\.(png|jpg)$/.test(n));
  assert.equal(files.length, 2);
  const png = readFileSync(
    resolve(
      downloads,
      files.find((n) => n.endsWith('.png')),
    ),
  );
  assert.equal(png.readUInt32BE(16), 960);
  assert.equal(png.readUInt32BE(20), 600);
  const viewports = [];
  for (const width of [360, 390, 768, 1024, 1440]) {
    for (const theme of ['light', 'dark']) {
      await evaluate(
        'localStorage.setItem("nesomn-theme",' +
          JSON.stringify(theme) +
          ');window.dispatchEvent(new Event("storage"));document.querySelectorAll("button[aria-label=Close]").forEach(b=>b.click());',
      );
      viewports.push({ theme, ...(await capture('scene-' + theme + '-' + width, width)) });
      const bounds = await evaluate(
        '(()=>{const c=document.querySelector(".konvajs-content").getBoundingClientRect();return {width:c.width,height:c.height,right:c.right}})()',
      );
      assert.ok(bounds.right <= width);
      assert.ok(bounds.width > 0);
    }
  }
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 720,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await sleep(400);
  const shortViewport = await evaluate(
    '(()=>{const workspace=document.querySelector(\'[aria-label="2D scene workspace"]\');workspace.scrollTop=workspace.scrollHeight;const aside=workspace.querySelector("aside");aside.scrollTop=aside.scrollHeight;const input=[...aside.querySelectorAll("label")].find(label=>label.textContent.startsWith("opacity")).querySelector("input");input.scrollIntoView({block:"nearest"});const r=input.getBoundingClientRect();return {overflow:getComputedStyle(workspace).overflowY,top:r.top,bottom:r.bottom,height:r.height,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===input};})()',
  );
  assert.equal(shortViewport.overflow, 'auto');
  assert.ok(shortViewport.top >= 0 && shortViewport.bottom <= 720);
  assert.ok(shortViewport.height >= 44);
  assert.equal(shortViewport.hit, true);
  const shortImage = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(
    folder + '/scene-properties-short-mobile.png',
    Buffer.from(shortImage.data, 'base64'),
  );
  await evaluate('document.querySelector(\'[aria-label="2D scene workspace"]\').scrollTop=0');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await activateTab('AI Scene');
  await wait('document.querySelector("#ai-scene-prompt")');
  await evaluate(
    '(()=>{const e=document.querySelector("#ai-scene-prompt");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(e,"Sample prompt");e.dispatchEvent(new Event("input",{bubbles:true}));})()',
  );
  await evaluate('document.querySelector("#ai-scene-generate").click()');
  await wait('document.querySelector("#ai-scene-generate").disabled');
  assert.equal(creates, 1);
  await activateTab('Design');
  await activateTab('AI Scene');
  assert.equal(await evaluate('document.querySelector("#ai-scene-prompt").value'), 'Sample prompt');
  await wait('document.body.innerText.includes("Cancel pending job")');
  await click('Cancel pending job');
  await wait('document.body.innerText.includes("Sample failure")');
  assert.ok(!(await evaluate('document.body.innerText.includes("Credit dikembalikan")')));
  creditError = true;
  await go('/editor/scene');
  await sleep(2000);
  await activateTab('AI Scene');
  await wait('document.body.innerText.includes("Saldo gagal dimuat")');
  await evaluate('document.querySelector("details summary").click()');
  await click('Load job history');
  await wait('document.body.innerText.includes("sample-j" )');
  await click('sample-j · failed');
  await wait('document.body.innerText.includes("Sample failure")');
  assert.equal(creates, 1);
  await go('/editor/scene?project=wrong-kind');
  await wait('document.body.innerText.includes("bukan Scene 2D")');
  assert.equal(await evaluate('document.querySelectorAll(".konvajs-content").length'), 0);
  await go('/admin/');
  await wait('location.pathname==="/admin/assets"');
  for (const route of ['subscriptions', 'credit-ledger']) {
    await go('/admin/' + route);
    await wait('document.querySelector(".ant-table-row")');
    for (const width of [390, 1440])
      for (const theme of ['light', 'dark']) {
        await evaluate(
          'localStorage.setItem("nesomn-theme",' +
            JSON.stringify(theme) +
            ');window.dispatchEvent(new Event("storage"));',
        );
        await capture('admin-' + route + '-' + theme + '-' + width, width);
      }
  }
  assert.deepEqual(exceptions, []);
  assert.ok(network.every((n) => n === 'http://127.0.0.1:18090'));
  writeFileSync(
    folder + '/browser.json',
    JSON.stringify(
      {
        browser: version.Browser,
        fixture:
          'Compiled production client/admin with explicit isolated HTTP fixtures, no real database/provider',
        viewports,
        legacyRoundtrip: true,
        duplicateUndo: true,
        exports: files,
        exportDimensions: [960, 600],
        aiCreates: creates,
        jobReads,
        cancellations,
        tabRecovery: true,
        shortViewport,
        serverHistoryRecovery: true,
        creditOutage: true,
        wrongKind: true,
        adminDefaultRedirect: true,
        adminReadOnlyLists: true,
        diagnostics,
        exceptions,
      },
      null,
      2,
    ),
  );
  console.log(
    'PASS 2D legacy/save/undo/export, 5 widths x 2 themes, AI recovery/error, admin redirect and lists',
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
  await new Promise((r) => server.close(r));
}
