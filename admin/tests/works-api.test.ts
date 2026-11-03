import { expect, test } from 'bun:test';
import { workPayload, uploadWorkMedia, type WorkRecord } from '../src/pages/works-api';

test('editing submits only work fields and preserves ordered gallery references', () => {
  const media = {
    id: 'media-1',
    name: 'cover.png',
    mimeType: 'image/png',
    url: '/api/admin/works/media/media-1',
  };
  const record: WorkRecord = {
    id: 'work-1',
    revision: 4,
    updatedAt: '2026-11-03T00:00:00.000Z',
    title: 'Studio kit',
    slug: 'studio-kit',
    description: 'Sample',
    projectDate: '2026-11-03',
    client: null,
    status: 'draft',
    isSample: true,
    coverMediaId: media.id,
    cover: media,
    linkLabel: null,
    linkUrl: null,
    gallery: [
      {
        mediaId: 'video-2',
        alt: 'Animation',
        posterMediaId: media.id,
        media: { ...media, id: 'video-2', mimeType: 'video/mp4' },
        poster: media,
      },
      { mediaId: media.id, alt: 'Packaging', posterMediaId: null, media },
    ],
  };
  const payload = workPayload(record);
  expect(Object.keys(payload).sort()).toEqual(
    [
      'slug',
      'title',
      'description',
      'projectDate',
      'client',
      'status',
      'isSample',
      'coverMediaId',
      'linkLabel',
      'linkUrl',
      'gallery',
    ].sort(),
  );
  expect(payload.gallery).toEqual([
    { mediaId: 'video-2', alt: 'Animation', posterMediaId: 'media-1' },
    { mediaId: 'media-1', alt: 'Packaging', posterMediaId: null },
  ]);
  expect(record.gallery[0]?.media?.url).toContain('/media/');
});
test('unsupported uploads fail locally before sending a request', async () => {
  await expect(
    uploadWorkMedia(new File(['<script/>'], 'script.svg', { type: 'image/svg+xml' })),
  ).rejects.toThrow('Choose PNG');
});
