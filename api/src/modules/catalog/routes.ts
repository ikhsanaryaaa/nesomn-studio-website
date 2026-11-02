import { legacyEditorImageKey, editorImagePath } from '../../lib/legacy-editor-image.ts';
import { Elysia } from 'elysia';
import { z } from 'zod';
import { and, eq, sql, type SQL } from 'drizzle-orm';
import { db } from '../../db/client.ts';
import { assets, bundles, bundleItems, media } from '../../db/schema/index.ts';
import { AppError } from '../../middleware/error.ts';
import { parseListQuery, buildOrderBy, setTotalCount } from '../../lib/admin-query.ts';
import { authPlugin, type AuthUser } from '../../middleware/auth.ts';
import { canUseAsset } from '../../lib/feature-access.ts';
import { validateStorageKey } from '../../lib/storage/key.ts';
import { getStorage } from '../../lib/storage/index.ts';

/**
 * API katalog publik (tanpa auth). Hanya mengembalikan field aman:
 * fileKey/glbFile TIDAK pernah dikirim ke publik (lihat publicAsset).
 */

const ASSET_SORT = {
  title: assets.title,
  priceIdr: assets.priceIdr,
  createdAt: assets.createdAt,
};

/** Petakan baris asset ke bentuk publik (buang field rahasia). */
function publicAsset(a: typeof assets.$inferSelect) {
  return {
    id: a.id,
    slug: a.slug,
    title: a.title,
    description: a.description,
    type: a.type,
    tier: a.tier,
    editorType: a.editorType,
    category: a.category,
    tags: a.tags,
    version: a.version,
    status: a.status,
    isMarketplace: a.isMarketplace,
    isSubscriptionAsset: a.isSubscriptionAsset,
    thumbnail: a.thumbnail,
    priceIdr: a.priceIdr,
    priceUsd: a.priceUsd,
    previews: a.previews,
    popular: a.popular,
    createdAt: a.createdAt,
  };
}

const listQuery = z.object({
  type: z.enum(['font', 'mockup3d', 'mockup2d', 'asset3d', 'graphic', 'motion']).optional(),
  editorType: z.enum(['scene_editor', 'product_3d_editor']).optional(),
  tier: z.enum(['free', 'pro']).optional(),
  popular: z.enum(['true', 'false']).optional(),
  q: z.string().trim().min(1).optional(),
});

export const catalogRoutes = new Elysia({ prefix: '/catalog' })
  .use(authPlugin)
  .get('/preview/:id', async ({ params, user, set }) => {
    const id = z.string().uuid().parse(params.id);
    const path = '/api/catalog/preview/' + id;
    // A media ID alone never grants access to a private product file or draft.
    if ((user as AuthUser | null)?.role !== 'admin') {
      const published = await db.query.assets.findFirst({
        where: and(
          eq(assets.status, 'published'),
          sql`(${assets.previews} @> ${JSON.stringify([path])}::jsonb OR ${assets.thumbnail} = ${path})`,
        ),
      });
      if (!published) throw new AppError('NOT_FOUND', 'Preview tidak ditemukan.', 404);
    }
    const row = await db.query.media.findFirst({ where: eq(media.id, id) });
    if (!row || !['image/png', 'image/jpeg', 'image/webp'].includes(row.mimeType))
      throw new AppError('NOT_FOUND', 'Preview tidak ditemukan.', 404);
    const location = await (await getStorage()).getSignedUrl(validateStorageKey(row.key), 300);
    set.headers['cache-control'] = 'no-store';
    return new Response(null, { status: 302, headers: { location, 'cache-control': 'no-store' } });
  })
  .get('/assets', async ({ query, set }) => {
    const range = parseListQuery(query);
    const f = listQuery.parse(query);

    // Katalog publik hanya menampilkan aset yang sudah dipublikaslikan.
    const conds: SQL[] = [eq(assets.status, 'published')];
    if (f.type) conds.push(eq(assets.type, f.type));
    if (f.editorType) conds.push(eq(assets.editorType, f.editorType));
    if (f.tier) conds.push(eq(assets.tier, f.tier));
    if (f.popular) conds.push(eq(assets.popular, f.popular === 'true'));
    // Full-text search di kolom tsvector generated (search_vector).
    if (f.q) {
      conds.push(sql`${assets.searchVector} @@ plainto_tsquery('simple', ${f.q})`);
    }
    const where = and(...conds);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(assets)
      .where(where);

    const rows = await db.query.assets.findMany({
      where,
      orderBy: [buildOrderBy(range, ASSET_SORT, assets.createdAt)],
      limit: range.limit,
      offset: range.offset,
    });

    setTotalCount(set, count);
    return rows.map(publicAsset);
  })
  .get('/assets/:slug', async ({ params }) => {
    const row = await db.query.assets.findFirst({
      where: and(eq(assets.slug, params.slug), eq(assets.status, 'published')),
    });
    if (!row) throw new AppError('NOT_FOUND', 'Aset tidak ditemukan.', 404);
    return publicAsset(row);
  })
  // Loader khusus editor: kembalikan field yang dibutuhkan editor + signed URL
  // untuk base mockup. fileKey/glbFile mentah tetap tidak dibocorkan langsung.
  .get(
    '/editor-asset/:slug',
    async ({ params, user }) => {
      const row = await db.query.assets.findFirst({ where: eq(assets.slug, params.slug) });
      if (!row) throw new AppError('NOT_FOUND', 'Aset tidak ditemukan.', 404);

      const u = user as AuthUser;
      if (u.role !== 'admin' && !(await canUseAsset(u.id, row.id)))
        throw new AppError('FORBIDDEN', 'Aset tidak termasuk lisensi/plan Anda.', 403);
      const storage = await getStorage();
      // 3D pakai glbFile; mockup 2D pakai fileKey (gambar base) bila ada.
      const is3d = row.type === 'mockup3d' || row.type === 'asset3d';
      const baseKey = is3d ? (row.glbFile ?? row.fileKey) : row.fileKey;
      const modelUrl = baseKey
        ? await storage.getSignedUrl(validateStorageKey(baseKey), 300)
        : null;

      return {
        slug: row.slug,
        title: row.title,
        type: row.type,
        previews: row.previews,
        modelUrl,
      };
    },
    { requireAuth: true },
  )
  .get(
    '/editor-image/:slug',
    async ({ params, user }) => {
      const row = await db.query.assets.findFirst({ where: eq(assets.slug, params.slug) });
      if (!row || row.type !== 'mockup2d' || !row.fileKey)
        throw new AppError('NOT_FOUND', 'Gambar katalog tidak ditemukan.', 404);
      const u = user as AuthUser;
      if (u.role !== 'admin' && !(await canUseAsset(u.id, row.id)))
        throw new AppError('FORBIDDEN', 'Aset tidak termasuk lisensi/plan Anda.', 403);
      const location = await (
        await getStorage()
      ).getSignedUrl(validateStorageKey(row.fileKey), 300);
      return new Response(null, {
        status: 302,
        headers: { location, 'cache-control': 'no-store' },
      });
    },
    { requireAuth: true },
  )
  .post(
    '/resolve-editor-image',
    async ({ body, user }) => {
      const { src } = z.object({ src: z.string().max(4096) }).parse(body);
      const key = legacyEditorImageKey(src, process.env.R2_ENDPOINT, process.env.R2_BUCKET);
      if (!key)
        throw new AppError(
          'NOT_FOUND',
          'Sumber gambar lama tidak dikenali. Buka kembali aset dari katalog.',
          404,
        );
      const rows = await db.query.assets.findMany({
        where: and(eq(assets.fileKey, key), eq(assets.type, 'mockup2d')),
      });
      const u = user as AuthUser;
      for (const row of rows) {
        if (u.role === 'admin' || (await canUseAsset(u.id, row.id)))
          return { url: editorImagePath(row.slug) };
      }
      throw new AppError(
        'NOT_FOUND',
        'Gambar tidak tersedia atau lisensi tidak aktif. Buka kembali aset dari katalog.',
        404,
      );
    },
    { requireAuth: true },
  )
  .get('/bundles', async ({ query, set }) => {
    const range = parseListQuery(query);
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(bundles);
    const rows = await db.query.bundles.findMany({
      orderBy: [
        buildOrderBy(
          range,
          { title: bundles.title, createdAt: bundles.createdAt },
          bundles.createdAt,
        ),
      ],
      limit: range.limit,
      offset: range.offset,
    });
    setTotalCount(set, count);
    return rows;
  })
  .get('/bundles/:slug', async ({ params }) => {
    const bundle = await db.query.bundles.findFirst({ where: eq(bundles.slug, params.slug) });
    if (!bundle) throw new AppError('NOT_FOUND', 'Bundle tidak ditemukan.', 404);
    const items = await db.query.bundleItems.findMany({
      where: eq(bundleItems.bundleId, bundle.id),
    });
    const ids = items.map((i) => i.assetId);
    const assetRows = ids.length
      ? await db.query.assets.findMany({
          where: (a, { inArray, and, eq }) => and(inArray(a.id, ids), eq(a.status, 'published')),
        })
      : [];
    return { ...bundle, assets: assetRows.map(publicAsset) };
  });
