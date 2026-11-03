import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import sharp from '../api/node_modules/sharp';
import { workBody, validateWork } from '../api/src/modules/portfolio/schema';
import { validatePortfolioUpload } from '../api/src/modules/portfolio/upload';
import { byteRange } from '../api/src/lib/byte-range';
test('work metadata rejects unsafe links, incomplete publication and duplicates', () => {
  const input = workBody.parse({ slug: 'studio-kit', title: 'Studio Kit', client: '' });
  expect(input.status).toBe('draft');
  expect(input.client).toBeNull();
  expect(() =>
    workBody.parse({ ...input, linkUrl: 'javascript:alert(1)', linkLabel: 'Open' }),
  ).toThrow();
  expect(() => workBody.parse({ ...input, projectDate: '2026-02-30' })).toThrow();
  expect(() => validateWork({ ...input, status: 'published' })).toThrow();
  expect(() => validateWork({ ...input, linkLabel: 'Open' })).toThrow();
  const item = { mediaId: crypto.randomUUID(), posterMediaId: null, alt: 'Sample' };
  expect(() => validateWork({ ...input, gallery: [item, item] })).toThrow();
  expect(() =>
    workBody.parse({
      ...input,
      gallery: Array.from({ length: 41 }, () => ({ ...item, mediaId: crypto.randomUUID() })),
    }),
  ).toThrow();
});
test('portfolio validates original raster and video container fixtures, rejects forged/truncated contents', async () => {
  const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#ffffff' } })
    .png()
    .toBuffer();
  expect((await validatePortfolioUpload(png, 'image.png', 'text/plain')).mime).toBe('image/png');
  for (const ext of ['mp4', 'webm']) {
    const clip = await readFile('tests/fixtures/portfolio/sample.' + ext);
    expect(
      (await validatePortfolioUpload(clip, 'sample.' + ext, 'application/octet-stream')).mime,
    ).toBe('video/' + ext);
    await expect(
      validatePortfolioUpload(clip.subarray(0, 16), 'broken.' + ext, 'video/' + ext),
    ).rejects.toThrow();
  }
  await expect(
    validatePortfolioUpload(Buffer.from('<svg onload="alert(1)"/>'), 'bad.png', 'image/png'),
  ).rejects.toThrow();
  const fake = Buffer.alloc(32);
  fake.writeUInt32BE(32, 0);
  fake.write('ftyp', 4);
  await expect(validatePortfolioUpload(fake, 'fake.mp4', 'video/mp4')).rejects.toThrow();
});
test('byte ranges support seeking and reject overflow/multipart', () => {
  expect(byteRange('bytes=0-9', 100)).toEqual({ start: 0, end: 9 });
  expect(byteRange('bytes=90-', 100)).toEqual({ start: 90, end: 99 });
  expect(byteRange('bytes=-10', 100)).toEqual({ start: 90, end: 99 });
  for (const value of [
    'bytes=100-',
    'bytes=20-10',
    'bytes=0-1,4-5',
    'bytes=-0',
    'bytes=999999999999999999999-',
  ])
    expect(byteRange(value, 100)).toBe('invalid');
});
