import { test, expect } from 'bun:test';
import { assertProviderUrl, publicAddress } from '../../api/src/lib/outbound.ts';
import { validateUpload } from '../../api/src/lib/upload-validation.ts';
test('provider URL allowlist blocks local/credential/redirect targets and reserved addresses', () => {
  const hosts = ['api.vendor.example'];
  expect(assertProviderUrl('https://api.vendor.example/v1', hosts).hostname).toBe(
    'api.vendor.example',
  );
  for (const url of [
    'http://api.vendor.example',
    'https://user:secret@api.vendor.example',
    'https://127.0.0.1',
    'https://api.vendor.example.evil.test',
    'https://api.vendor.example/?secret=x',
    'https://api.vendor.example#x',
  ])
    expect(() => assertProviderUrl(url, hosts)).toThrow();
  for (const ip of [
    '127.0.0.1',
    '10.0.0.1',
    '169.254.169.254',
    '192.168.0.1',
    '100.64.0.1',
    '0.0.0.0',
    '::1',
    'fc00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    '2001:db8::1',
  ])
    expect(publicAddress(ip)).toBe(false);
  expect(publicAddress('1.1.1.1')).toBe(true);
  expect(publicAddress('2606:4700:4700::1111')).toBe(true);
});
test('upload ignores claimed MIME, rejects script/corrupt images and non-contained glTF', async () => {
  await expect(
    validateUpload(
      new TextEncoder().encode('<script>x</script>'),
      'test.png',
      'image/png',
      'preview',
    ),
  ).rejects.toThrow();
  await expect(
    validateUpload(
      new TextEncoder().encode('<svg onload="alert(1)"/>'),
      'test.svg',
      'image/svg+xml',
      'preview',
    ),
  ).rejects.toThrow();
  await expect(
    validateUpload(
      new TextEncoder().encode(
        '{"asset":{"version":"2.0"},"buffers":[{"uri":"https://evil.test/a.bin","byteLength":10}]}',
      ),
      'test.gltf',
      'model/gltf+json',
      'file',
    ),
  ).rejects.toThrow();
});
