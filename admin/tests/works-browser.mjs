import { Buffer } from 'node:buffer';
import { URL } from 'node:url';
import { setTimeout } from 'node:timers';
import console from 'node:console';
const { WebSocket } = globalThis;
// Explicit offline UI fixture. No database, production API, merchant or user account.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import {
  chromeExecutable,
  launchChrome,
  waitChromeReady,
} from '../../tests/lib/browser-runtime.mjs';
import { selectTheme } from '../../tests/lib/theme-control.mjs';

const run = Date.now();
const folder = resolve('docs/revision/artifacts/works-phase1-2026-11-03/admin-' + run);
const cache = resolve('.cache/works-admin-browser-' + run);
mkdirSync(folder, { recursive: true });
mkdirSync(cache, { recursive: true });
const image = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jwm0AAAAASUVORK5CYII=',
  'base64',
);
const imageFile = resolve(cache, 'sample.png');
writeFileSync(imageFile, image);
const media = new Map();
const mediaBytes = new Map();
let rangeRequests = 0;
const mutations = [];
let work,
  mediaCounter = 0,
  uploadFailure = false;
const root = resolve('admin/dist'),
  base = 'http://127.0.0.1:18112';
const types = {
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.html': 'text/html',
  '.png': 'image/png',
};
function hydrate(record) {
  return {
    ...record,
    cover: media.get(record.coverMediaId) ?? null,
    gallery: record.gallery.map((item) => ({
      ...item,
      media: media.get(item.mediaId),
      poster: media.get(item.posterMediaId) ?? null,
    })),
  };
}
const server = createServer(async (req, res) => {
  const url = new URL(req.url, base),
    path = url.pathname;
  const json = (status, data) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(data));
  };
  if (path === '/api/me')
    return json(200, {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Sample fixture administrator',
      email: 'sample@test.invalid',
      role: 'admin',
    });
  if (path.startsWith('/api/admin/works/media/') && req.method === 'GET') {
    const id = path.split('/').at(-1),
      item = media.get(id),
      bytes = mediaBytes.get(id);
    if (!item || !bytes) return json(404, { error: { message: 'Fixture media missing' } });
    const headers = { 'content-type': item.mimeType, 'accept-ranges': 'bytes' };
    const range = req.headers.range;
    if (range) {
      rangeRequests++;
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      const start = match?.[1]
        ? Number(match[1])
        : match?.[2]
          ? Math.max(0, bytes.length - Number(match[2]))
          : 0;
      const end = Math.min(
        bytes.length - 1,
        match?.[2] && match[1] ? Number(match[2]) : bytes.length - 1,
      );
      if (!match || start > end || start >= bytes.length) {
        res.writeHead(416, { ...headers, 'content-range': 'bytes */' + bytes.length });
        res.end();
        return;
      }
      res.writeHead(206, {
        ...headers,
        'content-length': String(end - start + 1),
        'content-range': 'bytes ' + start + '-' + end + '/' + bytes.length,
      });
      res.end(bytes.subarray(start, end + 1));
      return;
    }
    res.writeHead(200, { ...headers, 'content-length': String(bytes.length) });
    res.end(bytes);
    return;
  }
  if (path === '/api/admin/works/media' && req.method === 'POST') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    if (uploadFailure) {
      uploadFailure = false;
      return json(503, {
        error: { code: 'TEST_UPLOAD_FAILURE', message: 'Explicit upload failure fixture' },
      });
    }
    const raw = Buffer.concat(chunks);
    const boundary = /boundary=(?:"([^"]+)"|([^;]+))/.exec(req.headers['content-type'] ?? '');
    const begin = raw.indexOf('\r\n\r\n') + 4;
    const finish = raw.lastIndexOf('\r\n--' + (boundary?.[1] ?? boundary?.[2]));
    const text = raw.subarray(0, begin).toString('latin1');
    assert.ok(begin >= 4 && finish > begin, 'Expected multipart file bytes');
    const id = '00000000-0000-4000-8000-' + String(++mediaCounter).padStart(12, '0');
    const item = {
      id,
      name: /filename="([^"]+)"/.exec(text)?.[1] ?? 'sample.png',
      mimeType: /Content-Type: ([^\r\n]+)/i.exec(text)?.[1] ?? 'image/png',
      url: '/api/admin/works/media/' + id,
    };
    media.set(id, item);
    mediaBytes.set(id, raw.subarray(begin, finish));
    return json(201, item);
  }
  if (path === '/api/admin/works' && req.method === 'GET') {
    res.setHeader('x-total-count', work ? '1' : '0');
    return json(200, work ? [hydrate(work)] : []);
  }
  if (path.startsWith('/api/admin/works') && (req.method === 'POST' || req.method === 'PUT')) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    mutations.push({ method: req.method, body });
    if (body.slug === 'occupied')
      return json(409, { error: { code: 'SLUG_TAKEN', message: 'This URL slug already exists.' } });
    if (req.method === 'PUT' && body.expectedRevision !== work.revision)
      return json(409, { error: { code: 'WORK_CONFLICT', message: 'Work changed on server.' } });
    const { expectedRevision, ...values } = body;
    void expectedRevision;
    work = {
      ...values,
      id: '22222222-2222-4222-8222-222222222222',
      revision: work ? work.revision + 1 : 1,
      updatedAt: new Date().toISOString(),
    };
    return json(req.method === 'POST' ? 201 : 200, hydrate(work));
  }
  if (path.startsWith('/api/admin/works/') && req.method === 'GET')
    return work ? json(200, hydrate(work)) : json(404, { error: { message: 'Work not found.' } });
  if (path.startsWith('/api/'))
    return json(404, { error: { message: 'Explicit fixture route missing.' } });
  const file = resolve(root, '.' + (path.startsWith('/admin/') ? path.slice(6) : path));
  if (file !== root && !file.startsWith(root + sep)) {
    res.writeHead(404);
    res.end();
    return;
  }
  const target = extname(file) ? file : resolve(root, 'index.html');
  if (!existsSync(target)) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { 'content-type': types[extname(target)] ?? 'application/octet-stream' });
  res.end(readFileSync(target));
});
await new Promise((r) => server.listen(18112, '127.0.0.1', r));
const chrome = launchChrome(
  chromeExecutable(),
  [
    '--headless=new',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=9272',
    '--user-data-dir=' + resolve(cache, 'profile'),
  ],
  { windowsHide: true, stdio: 'ignore' },
);
let ws,
  session,
  seq = 0;
const pending = new Map(),
  exceptions = [],
  dialogs = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function send(method, params = {}, sid = session) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, ...(sid ? { sessionId: sid } : {}) }));
  });
}
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails)
    throw Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
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
  await wait('document.readyState==="complete"&&document.querySelector("#root")?.children.length');
  await sleep(300);
}
async function input(id, value) {
  await evaluate(
    '(()=>{const e=document.getElementById(' +
      JSON.stringify(id) +
      ');const p=e.tagName==="TEXTAREA"?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,"value").set.call(e,' +
      JSON.stringify(value) +
      ');e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}));})()',
  );
}
async function click(text) {
  await evaluate(
    '[...document.querySelectorAll("button")].find(e=>e.textContent.trim()===' +
      JSON.stringify(text) +
      ').click()',
  );
}
async function upload(id, file = imageFile) {
  const doc = await send('DOM.getDocument');
  const node = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '#' + id });
  await send('DOM.setFileInputFiles', { nodeId: node.nodeId, files: [file] });
  await wait('!document.querySelector("#work-form fieldset").disabled');
  await sleep(150);
}
try {
  const version = await waitChromeReady(chrome, 9272);
  ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  ws.addEventListener('message', (e) => {
    const data = JSON.parse(e.data);
    if (data.id) {
      const p = pending.get(data.id);
      pending.delete(data.id);
      if (p) {
        if (data.error) p.reject(Error(data.error.message));
        else p.resolve(data.result);
      }
    }
    if (data.method === 'Page.javascriptDialogOpening') {
      dialogs.push(data.params.type);
      void send('Page.handleJavaScriptDialog', { accept: true });
    }
    if (data.method === 'Runtime.exceptionThrown')
      exceptions.push(data.params.exceptionDetails.text);
  });
  session = (
    await send(
      'Target.attachToTarget',
      {
        targetId: (await send('Target.createTarget', { url: 'about:blank' }, null)).targetId,
        flatten: true,
      },
      null,
    )
  ).sessionId;
  await send('Page.enable');
  await send('Runtime.enable');
  await send('DOM.enable');
  await go('/admin/works/create');
  await wait('document.querySelector("#work-title")');
  await input('work-title', 'Demo / Sample studio kit');
  await input('work-slug', 'occupied');
  await click('Save changes');
  await wait('document.body.textContent.includes("This URL slug already exists.")');
  assert.equal(await evaluate('document.querySelector("button[form=work-form]").disabled'), false);
  assert.equal(
    await evaluate(
      '[...document.querySelectorAll("button")].some(e=>e.textContent==="Reload server version")',
    ),
    false,
  );
  await input('work-slug', 'sample-studio-kit');
  await input('work-description', 'Original internal concept.');
  await input('work-date', '2026-11-03');
  await upload('work-cover-upload');
  await wait('document.querySelector(".works-cover-preview img")');
  await upload('work-gallery-upload');
  await wait('document.querySelectorAll(".works-gallery-item").length===1');
  await upload('work-gallery-upload');
  await wait('document.querySelectorAll(".works-gallery-item").length===2');
  await input('work-alt-00000000-0000-4000-8000-000000000002', 'First artwork');
  await input('work-alt-00000000-0000-4000-8000-000000000003', 'Second artwork');
  await evaluate(
    'document.querySelector(' +
      JSON.stringify('[aria-label="Move gallery item 2 up"]') +
      ').click()',
  );
  await upload('work-gallery-upload', resolve('tests/fixtures/portfolio/sample.mp4'));
  await wait('document.querySelectorAll(".works-gallery-item").length===3');
  await upload('work-gallery-upload', resolve('tests/fixtures/portfolio/sample.webm'));
  await wait('document.querySelectorAll(".works-gallery-item").length===4');
  await upload('work-poster-00000000-0000-4000-8000-000000000004');
  await upload('work-poster-00000000-0000-4000-8000-000000000005');
  await evaluate(
    'document.querySelector(' +
      JSON.stringify('[aria-label="Move gallery item 3 up"]') +
      ').click()',
  );
  await wait(
    '[...document.querySelectorAll(".works-gallery-preview video")].length===2 && [...document.querySelectorAll(".works-gallery-preview video")].every(v=>Number.isFinite(v.duration)&&v.duration>0&&v.readyState>=1)',
  );
  const playback = await evaluate(
    '(async()=>{const results=[];for(const video of document.querySelectorAll(".works-gallery-preview video")){video.muted=true;video.currentTime=0;await video.play();await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error("Video did not finish")),5000);video.addEventListener("ended",()=>{clearTimeout(timer);resolve();},{once:true});});results.push({duration:video.duration,time:video.currentTime,ended:video.ended,poster:!!video.poster});}return results;})()',
  );
  assert.equal(playback.length, 2);
  for (const clip of playback) {
    assert.ok(clip.duration > 0 && clip.time > 0 && clip.ended && clip.poster);
  }
  for (const width of [390, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: width < 600,
    });
    for (const [index, format] of ['mp4', 'webm'].entries()) {
      await evaluate(
        'document.querySelectorAll(".works-gallery-preview video")[' +
          index +
          '].closest("li").scrollIntoView({block:"center"})',
      );
      await sleep(150);
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(
        resolve(folder, 'decoded-video-' + format + '-' + width + '.png'),
        Buffer.from(shot.data, 'base64'),
      );
    }
  }
  console.log('PNG, MP4 and WebM upload/metadata/playback passed; saving create');
  await click('Save changes');
  await wait(
    'location.pathname.includes("/edit/")&&document.querySelector("#work-title")?.value==="Demo / Sample studio kit"',
  );
  assert.equal(work.gallery[0].mediaId, '00000000-0000-4000-8000-000000000003');
  assert.deepEqual(
    work.gallery.map((item) => media.get(item.mediaId).mimeType),
    ['image/png', 'video/mp4', 'image/png', 'video/webm'],
  );
  assert.equal(work.gallery[1].posterMediaId, '00000000-0000-4000-8000-000000000006');
  assert.equal(work.gallery[3].posterMediaId, '00000000-0000-4000-8000-000000000007');
  await wait(
    '[...document.querySelectorAll(".works-gallery-preview video")].every(v=>v.duration>0&&v.poster)',
  );
  console.log('mixed gallery order and video posters survive create/load');
  await input('work-description', 'Second save.');
  await click('Save changes');
  await wait('document.body.textContent.includes("Draft saved.")');
  assert.equal(work.revision, 2);
  assert.equal(work.description, 'Second save.');
  assert.equal(mutations.at(-1).body.expectedRevision, 1);
  assert.equal('id' in mutations.at(-1).body, false);
  assert.equal('media' in mutations.at(-1).body.gallery[0], false);
  console.log('second save complete');
  work.description = 'Server version';
  work.revision++;
  await input('work-description', 'My unsaved edit');
  await click('Save changes');
  await wait('document.body.textContent.includes("Your edits are still here.")');
  assert.equal(
    await evaluate('document.querySelector("#work-description").value'),
    'My unsaved edit',
  );
  await click('Reload server version');
  await wait('document.querySelector("[role=alertdialog]")');
  await click('Keep editing');
  await wait('!document.querySelector("[role=alertdialog]")');
  assert.equal(
    await evaluate('document.querySelector("#work-description").value'),
    'My unsaved edit',
  );
  await click('Reload server version');
  await wait('document.querySelector("[role=alertdialog]")');
  await click('Reload');
  await wait('document.querySelector("#work-description")?.value==="Server version"');
  await wait('document.activeElement?.id === "work-title"');
  uploadFailure = true;
  await upload('work-cover-upload');
  await wait('document.body.textContent.includes("Explicit upload failure fixture")');
  assert.ok(await evaluate('!!document.querySelector(".works-cover-preview img")'));
  const shots = [];
  for (const theme of ['light', 'dark']) {
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await selectTheme(evaluate, wait, theme);
    await sleep(450);
    for (const width of [360, 390, 768, 1024, 1440]) {
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height: 1000,
        deviceScaleFactor: 1,
        mobile: width < 600,
      });
      await evaluate('window.scrollTo(0,0)');
      await sleep(200);
      const geometry = await evaluate(
        '({width:innerWidth,scroll:document.documentElement.scrollWidth})',
      );
      assert.ok(geometry.scroll <= geometry.width, 'Works page overflow' + width);
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(
        resolve(folder, 'works-' + theme + '-' + width + '.png'),
        Buffer.from(shot.data, 'base64'),
      );
      shots.push({ theme, ...geometry });
      if (width === 390 || width === 1440) {
        await evaluate('document.querySelector(".works-gallery").scrollIntoView({block:"start"})');
        await sleep(200);
        const galleryShot = await send('Page.captureScreenshot', { format: 'png' });
        writeFileSync(
          resolve(folder, 'mixed-gallery-' + theme + '-' + width + '.png'),
          Buffer.from(galleryShot.data, 'base64'),
        );
      }
    }
  }
  assert.deepEqual(exceptions, []);
  assert.deepEqual(dialogs, [], 'Unexpected native dialog during save');
  writeFileSync(
    resolve(folder, 'browser.json'),
    JSON.stringify(
      {
        fixture: 'Explicit offline admin API/media fixture; no database, real user or merchant',
        browser: version.Browser,
        create: true,
        duplicateSlugRecoverable: true,
        upload: true,
        mixedGallery: ['image/png', 'video/mp4', 'image/png', 'video/webm'],
        playback,
        rangeRequests,
        reorder: true,
        repeatedSave: true,
        conflictRetainsDraft: true,
        confirmedReload: true,
        uploadErrorRetainsCover: true,
        shots,
        exceptions,
      },
      null,
      2,
    ),
  );
  console.log(
    'PASS Works create/edit, upload/reorder, duplicate slug, repeated save, conflict retention/reload, upload error; five widths x two themes. Artifacts: ' +
      folder,
  );
} finally {
  if (ws?.readyState === 1) {
    try {
      await send('Browser.close', {}, null);
    } catch {
      /* browser closed transport */
    }
    ws.close();
  }
  chrome.kill();
  await new Promise((r) => server.close(r));
}
