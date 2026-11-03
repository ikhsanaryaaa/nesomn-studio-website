import { Elysia } from 'elysia';
import { z } from 'zod';
import { and, eq, sql, desc } from 'drizzle-orm';
import { db } from '../../db/client.ts';
import {
  portfolioWorks as works,
  portfolioUploads as uploads,
  media,
  auditLogs,
} from '../../db/schema/index.ts';
import { AppError } from '../../middleware/error.ts';
import { authPlugin, type AuthUser } from '../../middleware/auth.ts';
import { getStorage } from '../../lib/storage/index.ts';
import { validatePortfolioUpload } from './upload.ts';
import { parseListQuery, buildOrderBy, setTotalCount } from '../../lib/admin-query.ts';
import { workBody, workUpdateBody } from './schema.ts';
import { hydrateWork, saveWork, portfolioMediaUrl } from './service.ts';
const idSchema = z.string().uuid();
const columns = {
  title: works.title,
  slug: works.slug,
  status: works.status,
  projectDate: works.projectDate,
  createdAt: works.createdAt,
  updatedAt: works.updatedAt,
};
const imageMimes = ['image/png', 'image/jpeg', 'image/webp'];
const videoMimes = ['video/mp4', 'video/webm'];

async function redirectMedia(id: string, admin: boolean) {
  idSchema.parse(id);
  const [file] = await db
    .select({ key: media.key, mimeType: media.mimeType })
    .from(uploads)
    .innerJoin(media, eq(media.id, uploads.mediaId))
    .where(eq(uploads.mediaId, id));
  if (!file) throw new AppError('NOT_FOUND', 'Portfolio media not found.', 404);
  if (!admin) {
    const [reference] = await db
      .select({ id: works.id })
      .from(works)
      .where(
        and(
          eq(works.status, 'published'),
          sql`(${works.coverMediaId} = ${id} OR EXISTS(SELECT 1 FROM portfolio_gallery g WHERE g.work_id = ${works.id} AND (g.media_id = ${id} OR g.poster_media_id = ${id})))`,
        ),
      )
      .limit(1);
    if (!reference) throw new AppError('NOT_FOUND', 'Portfolio media not found.', 404);
  }
  return new Response(null, {
    status: 302,
    headers: {
      location: await (await getStorage()).getSignedUrl(file.key, 300),
      'cache-control': 'no-store',
    },
  });
}

/** Mounted only inside the existing requireAdmin guard. */
export const worksAdminRoutes = new Elysia({ prefix: '/works' })
  .use(authPlugin)
  .get('/', async ({ query, set }) => {
    const range = parseListQuery(query);
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(works);
    const rows = await db
      .select()
      .from(works)
      .orderBy(buildOrderBy(range, columns, works.createdAt))
      .limit(range.limit)
      .offset(range.offset);
    setTotalCount(set, count);
    return Promise.all(rows.map((row) => hydrateWork(row, true)));
  })
  .post('/media', async ({ body, user, set }) => {
    const file = (body as { file?: File })?.file;
    if (!(file instanceof File)) throw new AppError('NO_FILE', 'Choose an image or video.', 422);
    const video = /\.(mp4|webm)$/i.test(file.name);
    if (!file.size || file.size > (video ? 100 : 20) * 1024 * 1024)
      throw new AppError('TOO_LARGE', video ? 'Video limit is100MB.' : 'Image limit is20MB.', 413);
    const bytes = new Uint8Array(await file.arrayBuffer());
    let checked: Awaited<ReturnType<typeof validatePortfolioUpload>>;
    try {
      checked = await validatePortfolioUpload(bytes, file.name, file.type);
      if (![...imageMimes, ...videoMimes].includes(checked.mime)) throw Error();
      if (video && !videoMimes.includes(checked.mime)) throw Error();
      if (!video && !imageMimes.includes(checked.mime)) throw Error();
    } catch {
      throw new AppError('BAD_TYPE', 'Upload a valid PNG, JPEG, WebP, MP4 or WebM file.', 422);
    }
    const name = Array.from(file.name, (char) => {
      const code = char.charCodeAt(0);
      return code < 32 || [47, 92, 127].includes(code) ? '_' : char;
    })
      .join('')
      .slice(-160);
    const key =
      'portfolio/' +
      crypto.randomUUID() +
      '.' +
      (
        {
          'image/png': 'png',
          'image/jpeg': 'jpg',
          'image/webp': 'webp',
          'video/mp4': 'mp4',
          'video/webm': 'webm',
        } as Record<string, string>
      )[checked.mime];
    const storage = await getStorage();
    try {
      await storage.put(key, bytes, checked.mime);
      const result = await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(media)
          .values({
            key,
            mimeType: checked.mime,
            ownerId: (user as AuthUser).id,
            sizeBytes: file.size,
            width: checked.width,
            height: checked.height,
          })
          .returning();
        await tx.insert(uploads).values({ mediaId: row!.id, name });
        return {
          id: row!.id,
          name,
          mimeType: row!.mimeType,
          width: row!.width,
          height: row!.height,
          url: portfolioMediaUrl(row!.id, true),
        };
      });
      set.status = 201;
      return result;
    } catch (error) {
      await storage.delete(key);
      throw error;
    }
  })
  .get('/media/:id', ({ params }) => redirectMedia(params.id, true))
  .get('/:id', async ({ params }) => {
    const [row] = await db
      .select()
      .from(works)
      .where(eq(works.id, idSchema.parse(params.id)));
    if (!row) throw new AppError('NOT_FOUND', 'Work not found.', 404);
    return hydrateWork(row, true);
  })
  .post('/', async ({ body, user, set }) => {
    const result = await saveWork(workBody.parse(body), (user as AuthUser).id);
    set.status = 201;
    return result;
  })
  .put('/:id', async ({ params, body, user }) => {
    const { expectedRevision, ...input } = workUpdateBody.parse(body);
    return saveWork(input, (user as AuthUser).id, idSchema.parse(params.id), expectedRevision);
  })
  .delete('/:id', async ({ params, user }) => {
    const id = idSchema.parse(params.id);
    await db.transaction(async (tx) => {
      const [row] = await tx.delete(works).where(eq(works.id, id)).returning({ id: works.id });
      if (!row) throw new AppError('NOT_FOUND', 'Work not found.', 404);
      await tx.insert(auditLogs).values({
        actorId: (user as AuthUser).id,
        action: 'portfolio.delete',
        targetType: 'portfolio_work',
        targetId: id,
      });
    });
    // Uploaded files intentionally survive: other works may share them.
    return { ok: true };
  });

export const worksPublicRoutes = new Elysia({ prefix: '/works' })
  .get('/media/:id', ({ params }) => redirectMedia(params.id, false))
  .get('/', async ({ query, set }) => {
    const range = parseListQuery(query),
      published = eq(works.status, 'published');
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(works)
      .where(published);
    setTotalCount(set, count);
    const rows = await db
      .select()
      .from(works)
      .where(published)
      .orderBy(desc(works.projectDate), desc(works.createdAt))
      .limit(range.limit)
      .offset(range.offset);
    return Promise.all(rows.map((row) => hydrateWork(row)));
  })
  .get('/:slug', async ({ params }) => {
    const slug = z
      .string()
      .regex(/^[a-z0-9][a-z0-9-]{0,159}$/)
      .parse(params.slug);
    const [row] = await db
      .select()
      .from(works)
      .where(and(eq(works.slug, slug), eq(works.status, 'published')));
    if (!row) throw new AppError('NOT_FOUND', 'Work not found.', 404);
    return hydrateWork(row);
  });
