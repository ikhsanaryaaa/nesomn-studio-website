import { Elysia } from 'elysia';
import { z } from 'zod';
import { and, eq, sql, type SQL } from 'drizzle-orm';
import { db } from '../../db/client.ts';
import { assets, bundles, bundleItems } from '../../db/schema/index.ts';
import { AppError } from '../../middleware/error.ts';
import { parseListQuery, buildOrderBy, setTotalCount } from '../../lib/admin-query.ts';

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
    priceIdr: a.priceIdr,
    priceUsd: a.priceUsd,
    previews: a.previews,
    popular: a.popular,
    createdAt: a.createdAt,
  };
}

const listQuery = z.object({
  type: z.enum(['font', 'mockup3d', 'mockup2d', 'asset3d', 'graphic', 'motion']).optional(),
  tier: z.enum(['free', 'pro']).optional(),
  popular: z.enum(['true', 'false']).optional(),
  q: z.string().trim().min(1).optional(),
});

export const catalogRoutes = new Elysia({ prefix: '/catalog' })
  .get('/assets', async ({ query, set }) => {
    const range = parseListQuery(query);
    const f = listQuery.parse(query);

    const conds: SQL[] = [];
    if (f.type) conds.push(eq(assets.type, f.type));
    if (f.tier) conds.push(eq(assets.tier, f.tier));
    if (f.popular) conds.push(eq(assets.popular, f.popular === 'true'));
    // Full-text search di kolom tsvector generated (search_vector).
    if (f.q) {
      conds.push(sql`${assets.searchVector} @@ plainto_tsquery('simple', ${f.q})`);
    }
    const where = conds.length ? and(...conds) : undefined;

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
    const row = await db.query.assets.findFirst({ where: eq(assets.slug, params.slug) });
    if (!row) throw new AppError('NOT_FOUND', 'Aset tidak ditemukan.', 404);
    return publicAsset(row);
  })
  .get('/bundles', async ({ query, set }) => {
    const range = parseListQuery(query);
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(bundles);
    const rows = await db.query.bundles.findMany({
      orderBy: [buildOrderBy(range, { title: bundles.title, createdAt: bundles.createdAt }, bundles.createdAt)],
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
      ? await db.query.assets.findMany({ where: (a, { inArray }) => inArray(a.id, ids) })
      : [];
    return { ...bundle, assets: assetRows.map(publicAsset) };
  });
