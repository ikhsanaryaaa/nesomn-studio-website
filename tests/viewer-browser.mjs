import { waitChromeReady } from './lib/browser-runtime.mjs';
import { createBrowserDiagnostics } from './lib/browser-runtime.mjs';
import { chromeExecutable, artifactDirectory, cacheDirectory } from './lib/browser-runtime.mjs';
// Production-built assets only; offline API fixture explicitly restricted to this test server.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { launchChrome } from './lib/browser-runtime.mjs';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, extname } from 'node:path';
const dist = resolve(process.env.NESOMN_VIEWER_DIST ?? 'client/dist'),
  folder =
    process.env.NESOMN_VIEWER_ARTIFACTS ??
    artifactDirectory('viewer', 'docs/revision/artifacts/phase-8'),
  downloads = resolve(
    cacheDirectory('viewer', '.cache/revision-phase-8') + '/downloads/run-' + Date.now(),
  );
mkdirSync(folder, { recursive: true });
mkdirSync(downloads, { recursive: true });
const models = JSON.parse(readFileSync('client/public/demo/models/manifest.json'));
const scene = {
  modelKey: 'sample:nesomn-product-box',
  background: '#eeeeea',
  materialColor: '#d6d3cc',
  grain: 0,
  camera: 'threeQuarter',
  decals: [
    {
      id: 'sample-decal',
      src:
        'data:image/svg+xml;base64,' +
        Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="black"/><circle cx="32" cy="32" r="20" fill="white"/></svg>',
        ).toString('base64'),
      position: [0, 0, 0.44],
      rotation: [0, 0, 0],
      scale: 0.6,
      meshPath: '0.0',
    },
  ],
};
const diagnostics = createBrowserDiagnostics();
let saved = null;
let badModel = false;
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path === '/__test/video') {
    const name = readdirSync(downloads).find((n) => n.endsWith('.webm'));
    if (!name) {
      res.statusCode = 404;
      res.end();
      return;
    }
    res.setHeader('content-type', 'video/webm');
    res.end(readFileSync(resolve(downloads, name)));
    return;
  }
  const json = (data) => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(data));
  };
  if (path === '/api/me')
    return json({
      id: 'demo-user',
      name: 'Demo / Sample tester',
      email: 'sample@test.invalid',
      role: 'admin',
    });
  if (path === '/api/projects/demo-project') {
    if (req.method === 'PUT') {
      let body = '';
      for await (const chunk of req) body += chunk;
      saved = JSON.parse(body);
      return json({ id: 'demo-project', title: saved.title, kind: 'scene3d', state: saved.state });
    }
    return json({
      id: 'demo-project',
      title: 'Demo / Sample scene',
      kind: 'scene3d',
      state: scene,
    });
  }
  if (path.startsWith('/api/')) {
    res.statusCode = 401;
    return json({ error: { message: 'Explicit offline fixture' } });
  }
  if (badModel && path.endsWith('.glb')) {
    res.statusCode = 200;
    res.end('invalid-model');
    return;
  }
  const file = resolve(dist, '.' + decodeURIComponent(path));
  if (!file.startsWith(dist)) {
    res.statusCode = 404;
    res.end();
    return;
  }
  const target = extname(path) ? file : resolve(dist, 'index.html');
  if (!existsSync(target)) {
    res.statusCode = 404;
    res.end();
    return;
  }
  const types = {
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.glb': 'model/gltf-binary',
    '.gltf': 'model/gltf+json',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
    '.json': 'application/json',
    '.html': 'text/html',
  };
  res.setHeader('content-type', types[extname(target)] ?? 'application/octet-stream');
  res.end(readFileSync(target));
});
await new Promise((r) => server.listen(18088, '127.0.0.1', r));
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
  await send('Page.navigate', { url: 'http://127.0.0.1:18088' + path });
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
async function capture(name, width) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: width < 600,
  });
  await sleep(600);
  const metrics = await evaluate(
    '({width:innerWidth,scroll:document.documentElement.scrollWidth})',
  );
  assert.ok(metrics.scroll <= metrics.width, name + ' overflow');
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(folder + '/' + name + '.png', Buffer.from(r.data, 'base64'));
  return metrics;
}
async function ready() {
  await wait('document.querySelector(".viewer-stage[data-state=ready] canvas")');
  await sleep(800);
  assert.equal(
    await evaluate('document.querySelector("canvas").getContext("webgl2").getError()'),
    0,
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
      '--remote-debugging-port=9238',
      '--user-data-dir=' +
        resolve(
          cacheDirectory('viewer', '.cache/revision-phase-8/browser-profile') + '/browser-profile',
        ),
    ],
    { windowsHide: true, stdio: 'ignore' },
  );
  const version = await waitChromeReady(chrome, 9238);

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
  await go('/demo/3d');
  const rendered = [];
  for (const width of [1440, 390])
    for (const m of models) {
      await click(m.title);
      await ready();
      rendered.push({ id: m.id, ...(await capture(m.id + '-' + width, width)) });
    }
  for (let round = 0; round < 3; round++)
    for (const m of models) {
      await click(m.title);
      await ready();
    }
  assert.equal(await evaluate('document.querySelectorAll("canvas").length'), 1);
  await click('Zoom +');
  await click('Zoom −');
  await click('Reset View');
  await click('Auto-Rotate Off');
  await sleep(300);
  await click('Auto-Rotate On');
  await click('Background: light');
  await click('Fullscreen');
  await sleep(300);
  assert.equal(await evaluate('!!document.fullscreenElement'), true);
  await click('Fullscreen');
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  await sleep(100);
  assert.equal(
    await evaluate(
      '[...document.querySelectorAll("button")].find(b=>b.textContent.includes("Auto-Rotate")).disabled',
    ),
    true,
  );
  badModel = true;
  await go('/demo/3d');
  await wait('document.querySelector(".viewer-stage[data-state=error]")');
  await capture('invalid-model-390', 390);
  badModel = false;
  await click('Try again');
  await ready();
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
  });
  const noGL = await send('Page.addScriptToEvaluateOnNewDocument', {
    source:
      'const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith("webgl")?null:original.call(this,type,...args);};',
  });
  await go('/demo/3d');
  await wait('document.body.innerText.includes("does not support WebGL")');
  await capture('no-webgl-390', 390);
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: noGL.identifier });
  await go('/editor/3d?project=demo-project');
  await wait('document.querySelector(".editor3d-canvas canvas")');
  await sleep(1000);
  await capture('editor3d-1440', 1440);
  await click('Decal 1');
  await wait('document.body.innerText.includes("Decal properties")');
  await click('Save');
  // Assert the save protocol and settled UI, rather than historical toast copy.
  for (let i = 0; i < 100 && !saved; i++) await sleep(100);
  assert.ok(saved, 'Save request did not reach the fixture');
  await wait(
    '[...document.querySelectorAll("button")].some(b => b.textContent.trim() === "Save" && !b.disabled)',
  );
  await wait(
    'document.querySelector(".editor3d-inspector [role=status]")?.textContent.includes("No unsaved changes")',
  );
  assert.equal(saved.state.modelKey, scene.modelKey);
  assert.equal(saved.state.grain, 0);
  assert.equal(saved.state.decals[0].meshPath, '0.0');
  await click('PNG');
  await click('JPEG');
  await click('Render Video');
  await wait(
    'document.body.innerText.includes("Video saved")||document.body.innerText.includes("Recording failed")',
  );
  await sleep(500);
  console.log(
    'video status',
    await evaluate(
      '({visible:document.visibilityState,notice:document.body.innerText.slice(-300)})',
    ),
  );
  const files = readdirSync(downloads).filter((n) => /\.(png|jpg|webm)$/.test(n));
  for (const ext of ['png', 'jpg', 'webm'])
    assert.ok(
      files.some((f) => f.endsWith('.' + ext) && statSync(resolve(downloads, f)).size > 1000),
      'missing ' + ext,
    );
  const metadata = await evaluate(
    'new Promise((resolve,reject)=>{const video=document.createElement("video");video.preload="auto";video.onloadeddata=()=>resolve({width:video.videoWidth,height:video.videoHeight,ready:video.readyState});video.onerror=()=>reject(Error("Video decode failed"));video.src="/__test/video";})',
  );
  assert.ok(
    metadata.width > 0 && metadata.width <= 1080 && metadata.height > 0 && metadata.height <= 1080,
  );
  await go('/demo/3d');
  await ready();
  assert.deepEqual(exceptions, []);
  assert.ok(
    network.every((n) => n === 'http://127.0.0.1:18088'),
    'Unexpected external environment/model request',
  );
  writeFileSync(
    folder + '/browser.json',
    JSON.stringify(
      {
        browser: version.Browser,
        renderer: 'Chrome software WebGL2 SwiftShader (not physical GPU/mobile device)',
        rendered,
        repeatedSwitches: 12,
        canvases: 1,
        controls: true,
        fullscreen: true,
        reducedMotion: true,
        invalidRetry: true,
        editorSaveRoundtrip: true,
        videoMetadata: metadata,
        exportFiles: files.map((name) => ({
          name,
          bytes: statSync(resolve(downloads, name)).size,
        })),
        externalRequests: false,
        diagnostics,
        exceptions,
        fixture:
          'Compiled production assets; explicit offline me/projects fixture, no real credentials/DB',
      },
      null,
      2,
    ),
  );
  console.log(
    'PASS4GLB desktop/mobile WebGL2,12switches,controls/fullscreen/reducedmotion/errorretry,editor save and PNG/JPEG/WebM',
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
