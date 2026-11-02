import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import process from 'node:process';
import { createTestInvocation } from './test-baseline.mjs';

// Never interpolate the developer's .env or COMPOSE_FILE into this read-only check.
const { env } = createTestInvocation('unit', process.env);
for (const [key, value] of Object.entries(process.env)) {
  if (/^(programfiles(?:\(x86\))?|programdata)$/i.test(key)) env[key] = value;
}
env.APP_ENV_FILE = resolve('.env.example');
env.COMPOSE_DISABLE_ENV_FILE = '1';
const args = ['compose', '--env-file', '.env.example'];
const config = JSON.parse(execFileSync('docker', [...args, 'config', '--format', 'json'], { env, encoding: 'utf8', windowsHide: true }));
assert.deepEqual(Object.keys(config.services).sort(), ['app', 'gateway'], 'Compose utama harus tepat app/gateway; periksa override/profiles');
assert.ok(!config.services.app.ports?.length, 'Port app harus private');
assert.equal(config.networks.data.external, true);
assert.equal(config.volumes.storage.external, true);
assert.ok(!Object.values(config.services).some((service) => service.profiles?.length));
process.stdout.write('PASS: app + gateway only; app port private; external data network/storage; no service profiles.\n');
