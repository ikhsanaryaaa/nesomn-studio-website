import { test, expect } from 'bun:test';
import { parsePublicWork } from '../client/src/lib/portfolio';
import { SAMPLE_WORK } from '../client/src/lib/portfolio-sample';
function fixture() {
  const ids = new Map<string, string>();
  const id = (old: string) => {
    if (!ids.has(old)) ids.set(old, crypto.randomUUID());
    return ids.get(old)!;
  };
  const media = (m: NonNullable<typeof SAMPLE_WORK.cover>) => ({
    ...m,
    id: id(m.id),
    url: '/api/works/media/' + id(m.id),
  });
  return {
    ...SAMPLE_WORK,
    status: 'published',
    cover: media(SAMPLE_WORK.cover!),
    gallery: SAMPLE_WORK.gallery.map((g) => ({
      ...g,
      mediaId: id(g.mediaId),
      posterMediaId: g.posterMediaId ? id(g.posterMediaId) : null,
      media: media(g.media),
      poster: g.poster ? media(g.poster) : null,
    })),
  };
}
test('public portfolio refuses private status, unsafe media/links and invalid calendar dates', () => {
  const good = fixture();
  expect(parsePublicWork(good).title).toBe('Nesomn Studio Kit');
  for (const patch of [
    { status: 'draft' },
    { projectDate: '2026-02-30' },
    { linkUrl: 'javascript:alert(1)' },
    { cover: { ...good.cover, url: 'https://evil.test/file.png' } },
  ])
    expect(() => parsePublicWork({ ...good, ...patch })).toThrow();
  expect(SAMPLE_WORK.isSample).toBe(true);
  expect(SAMPLE_WORK.client).toBeNull();
});
