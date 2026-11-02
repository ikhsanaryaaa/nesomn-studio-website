import process from 'node:process';
import { readFileSync } from 'node:fs';
import { URL, pathToFileURL } from 'node:url';

export function assertPinnedRuntime(actual, expected) {
  if (actual !== expected) {
    throw new Error(`Gunakan Bun ${expected}; runtime saat ini: ${actual ?? 'Node.js'}. Lihat docs/runtime.md.`);
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const expected = readFileSync(new URL('../.bun-version', import.meta.url), 'utf8').trim();
  assertPinnedRuntime(process.versions.bun, expected);
  process.stdout.write(`Bun ${expected}\n`);
}
