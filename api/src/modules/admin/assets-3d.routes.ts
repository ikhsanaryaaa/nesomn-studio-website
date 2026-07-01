import { Elysia } from 'elysia';
import { z } from 'zod';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../../db/client.ts';
import { assets } from '../../db/schema/index.ts';
import { AppError } from '../../middleware/error.ts';
import { parseListQuery, buildOrderBy, setTotalCount } from '../../lib/admin-query.ts';

/**
 * CRUD admin khusus aset 3D (editorType=product_3d_editor).
 * Resource TERPISAH dari aset scene: route, validasi, dan filter sendiri.
 * Hanya tipe 3D (mockup3d, asset3d) yang diizinkan di sini.
 */

const ASSET_COLUMNS = {
  title: assets.title,
  slug: assets.slug,
  type: assets.type,
  tier: assets.tier,
  status: assets.status,
  createdAt: assets.createdAt,
};

const asset3dBody = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullish(),
  type: z.enum(['mockup3d', 'asset3d']),
  tier: z.enum(['free', 'pro']).default('free'),
  category: z.string().nullish(),
  tags: z.array(z.string()).default([]),
  version: z.string().default('1.0.0'),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  isMarketplace: z.boolean().default(false),
  isSubscriptionAsset: z.boolean().default(true),
  thumbnail: z.string().nullish(),
  priceIdr: z.union([z.string(), z.number()]).transform(String).default('0'),
  priceUsd: z.union([z.string(), z.number()]).transform(String).default('0'),
  previews: z.array(z.string()).default([]),
  fileKey: z.string().nullish(),
  glbFile: z.string().nullish(),
  popular: z.boolean().default(false),
});

// Diskriminator domain: semua query & tulis dipaksa editorType 3D.
const ONLY_3D = eq(assets.editorType, 'product_3d_editor');

export const assets3dAdminRoutes = new Elysia({ prefix: '/assets-3d' })
  .get('/', async ({ query, set }) => {
    const range = parseListQuery(query);
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(assets)
      .where(ONLY_3D);
    const rows = await db.query.assets.findMany({
      where: ONLY_3D,
      orderBy: [buildOrderBy(range, ASSET_COLUMNS, assets.createdAt)],
      limit: range.limit,
      offset: range.offset,
    });
    setTotalCount(set, count);
    return rows;
  })
  .get('/:id', async ({ params }) => {
    const row = await db.query.assets.findFirst({
      where: and(eq(assets.id, params.id), ONLY_3D),
    });
    if (!row) throw new AppError('NOT_FOUND', 'Aset 3D tidak ditemukan.', 404);
    return row;
  })
  .post('/', async ({ body, set }) => {
    const input = asset3dBody.parse(body);
    const [row] = await db
      .insert(assets)
      .values({ ...input, editorType: 'product_3d_editor' })
      .returning();
    set.status = 201;
    return row;
  })
  .patch('/:id', async ({ params, body }) => {
    const input = asset3dBody.partial().parse(body);
    const [row] = await db
      .update(assets)
      .set({ ...input, editorType: 'product_3d_editor', updatedAt: new Date() })
      .where(and(eq(assets.id, params.id), ONLY_3D))
      .returning();
    if (!row) throw new AppError('NOT_FOUND', 'Aset 3D tidak ditemukan.', 404);
    return row;
  })
  .delete('/:id', async ({ params }) => {
    const [row] = await db
      .delete(assets)
      .where(and(eq(assets.id, params.id), ONLY_3D))
      .returning();
    if (!row) throw new AppError('NOT_FOUND', 'Aset 3D tidak ditemukan.', 404);
    return { ok: true };
  });
