import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { waitChromeReady } from './lib/browser-runtime.mjs';

test('Chrome startup can take longer than six seconds before the CDP listener is ready', async () => {
  let requests = 0;
  const server = createServer((_, response) => {
    requests++;
    if (requests <= 65) {
      response.writeHead(503);
      response.end('Starting');
      return;
    }
    response.setHeader('content-type', 'application/json');
    response.end(
      JSON.stringify({ webSocketDebuggerUrl: 'ws://127.0.0.1/devtools/browser/synthetic' }),
    );
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    const result = await waitChromeReady(
      { exitCode: null, startupDiagnostics: () => 'Chrome debug endpoint unavailable' },
      server.address().port,
    );
    assert.ok(result.webSocketDebuggerUrl);
    assert.ok(requests > 60);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('CDP wait fails quickly on process exit and stays bounded for a silent listener', async () => {
  await assert.rejects(waitChromeReady({exitCode:1,startupDiagnostics:()=> 'Chrome exited with code 1'},1),/exited/);
  const start=Date.now();
  await assert.rejects(waitChromeReady({exitCode:null,startupDiagnostics:()=> 'deadline exceeded'},1,{timeoutMs:80,pollMs:10}),/deadline exceeded/);
  assert.ok(Date.now()-start < 2000);
});

test('every production browser suite waits on its own Chrome debugging port', async () => {
  const { readdirSync,readFileSync } = await import('node:fs');
  for(const file of readdirSync('tests').filter(f=>f.endsWith('-browser.mjs'))) {
    const source=readFileSync('tests/'+file,'utf8');
    const port=source.match(/remote-debugging-port=(\d+)/)?.[1];
    assert.ok(port,file);
    assert.ok(source.includes('waitChromeReady(chrome, '+port+')'),file);
    assert.doesNotMatch(source,/let i = 0; i < 60;/,file);
  }
});
