import { and, eq, inArray, asc, sql } from 'drizzle-orm';
import { db } from '../../db/client.ts';
import {
  portfolioWorks as works,
  portfolioGallery as gallery,
  portfolioUploads as uploads,
  media,
  auditLogs,
} from '../../db/schema/index.ts';
import { AppError } from '../../middleware/error.ts';
import { validateWork, type WorkInput } from './schema.ts';
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export const portfolioMediaUrl = (id: string, admin = false) => {
  const path = '/api/' + (admin ? 'admin/works' : 'works') + '/media/' + id;
  return process.env.API_URL ? new URL(path, process.env.API_URL).toString() : path;
};
export async function hydrateWork(row: typeof works.$inferSelect, admin = false) {
  const items = await db
    .select()
    .from(gallery)
    .where(eq(gallery.workId, row.id))
    .orderBy(asc(gallery.position));
  const ids = [
    ...new Set(
      [row.coverMediaId, ...items.flatMap((item) => [item.mediaId, item.posterMediaId])].filter(
        (id): id is string => !!id,
      ),
    ),
  ];
  const records = ids.length
    ? await db
        .select({
          id: media.id,
          name: uploads.name,
          mimeType: media.mimeType,
          width: media.width,
          height: media.height,
        })
        .from(uploads)
        .innerJoin(media, eq(media.id, uploads.mediaId))
        .where(inArray(media.id, ids))
    : [];
  const byId = new Map(
    records.map((item) => [item.id, { ...item, url: portfolioMediaUrl(item.id, admin) }]),
  );
  return {
    ...row,
    cover: row.coverMediaId ? byId.get(row.coverMediaId) : null,
    gallery: items.map((item) => ({
      mediaId: item.mediaId,
      alt: item.alt,
      posterMediaId: item.posterMediaId,
      media: byId.get(item.mediaId),
      poster: item.posterMediaId ? byId.get(item.posterMediaId) : null,
    })),
  };
}
async function checkMedia(tx: Tx, input: WorkInput) {
  try {
    validateWork(input);
  } catch (error) {
    throw new AppError('INVALID_WORK', (error as Error).message, 422);
  }
  const ids = [
    ...new Set(
      [
        input.coverMediaId,
        ...input.gallery.flatMap((item) => [item.mediaId, item.posterMediaId]),
      ].filter((id): id is string => !!id),
    ),
  ];
  const records = ids.length
    ? await tx
        .select({ id: media.id, mime: media.mimeType })
        .from(uploads)
        .innerJoin(media, eq(media.id, uploads.mediaId))
        .where(inArray(media.id, ids))
    : [];
  const byId = new Map(records.map((item) => [item.id, item.mime]));
  const image = (id: string) =>
    ['image/png', 'image/jpeg', 'image/webp'].includes(byId.get(id) ?? '');
  if (records.length !== ids.length || (input.coverMediaId && !image(input.coverMediaId)))
    throw new AppError(
      'INVALID_MEDIA',
      'Use uploaded portfolio media; the cover must be an image.',
      422,
    );
  for (const item of input.gallery) {
    const mime = byId.get(item.mediaId)!;
    if (!image(item.mediaId) && !['video/mp4', 'video/webm'].includes(mime))
      throw new AppError('INVALID_MEDIA', 'Unsupported gallery media.', 422);
    if (item.posterMediaId && (image(item.mediaId) || !image(item.posterMediaId)))
      throw new AppError('INVALID_MEDIA', 'Only video items can have an image poster.', 422);
    if (input.status === 'published' && image(item.mediaId) && !item.alt)
      throw new AppError(
        'INVALID_MEDIA',
        'Published gallery images need descriptive alternative text.',
        422,
      );
  }
}
function translateConflict(error: unknown): never {
  const e = error as { code?: string; cause?: { code?: string } };
  if ((e.cause?.code ?? e.code) === '23505')
    throw new AppError('SLUG_TAKEN', 'A work with this slug already exists.', 409);
  throw error;
}
export async function saveWork(
  input: WorkInput,
  actorId: string,
  id?: string,
  expectedRevision?: number,
) {
  let row: typeof works.$inferSelect;
  try {
    row = await db.transaction(async (tx) => {
      await checkMedia(tx, input);
      const { gallery: items, ...fields } = input;
      let saved: typeof works.$inferSelect | undefined;
      if (id) {
        [saved] = await tx
          .update(works)
          .set({ ...fields, revision: sql`${works.revision}+1`, updatedAt: new Date() })
          .where(and(eq(works.id, id), eq(works.revision, expectedRevision!)))
          .returning();
        if (!saved) {
          const [exists] = await tx.select({ id: works.id }).from(works).where(eq(works.id, id));
          throw new AppError(
            exists ? 'WORK_CONFLICT' : 'NOT_FOUND',
            exists ? 'This work changed in another tab. Reload before saving.' : 'Work not found.',
            exists ? 409 : 404,
          );
        }
        await tx.delete(gallery).where(eq(gallery.workId, id));
      } else [saved] = await tx.insert(works).values(fields).returning();
      if (items.length)
        await tx
          .insert(gallery)
          .values(items.map((item, position) => ({ ...item, workId: saved!.id, position })));
      await tx
        .insert(auditLogs)
        .values({
          actorId,
          action: id ? 'portfolio.update' : 'portfolio.create',
          targetType: 'portfolio_work',
          targetId: saved!.id,
          meta: { status: saved!.status, revision: saved!.revision },
        });
      return saved!;
    });
  } catch (error) {
    translateConflict(error);
  }
  return hydrateWork(row!, true);
}
