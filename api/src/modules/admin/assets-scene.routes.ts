import { Elysia } from 'elysia';
import { z } from 'zod';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../../db/client.ts';
import { assets } from '../../db/schema/index.ts';
import { AppError } from '../../middleware/error.ts';
import { parseListQuery, buildOrderBy, setTotalCount } from '../../lib/admin-query.ts';

/**
 * CRUD admin khusus aset Scene Editor (editorType=scene_editor).
 * Resource TERPISAH dari aset 3D: route, validasi, dan filter sendiri.
 * Tipe yang diizinkan: font, graphic, motion, mockup2d.
 */

const ASSET_COLUMNS = {
  title: assets.title,
  slug: assets.slug,
  type: assets.type,
  tier: assets.tier,
  status: assets.status,
  createdAt: assets.createdAt,
};

const assetSceneBody = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullish(),
  type: z.enum(['font', 'mockup2d', 'graphic', 'motion']),
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
  popular: z.boolean().default(false),
});

// Diskriminator domain: semua query & tulis dipaksa editorType scene.
const ONLY_SCENE = eq(assets.editorType, 'scene_editor');

export const assetsSceneAdminRoutes = new Elysia({ prefix: '/assets-scene' })
  .get('/', async ({ query, set }) => {
    const range = parseListQuery(query);
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(assets)
      .where(ONLY_SCENE);
    const rows = await db.query.assets.findMany({
      where: ONLY_SCENE,
      orderBy: [buildOrderBy(range, ASSET_COLUMNS, assets.createdAt)],
      limit: range.limit,
      offset: range.offset,
    });
    setTotalCount(set, count);
    return rows;
  })
  .get('/:id', async ({ params }) => {
    const row = await db.query.assets.findFirst({
      where: and(eq(assets.id, params.id), ONLY_SCENE),
    });
    if (!row) throw new AppError('NOT_FOUND', 'Aset scene tidak ditemukan.', 404);
    return row;
  })
  .post('/', async ({ body, set }) => {
    const input = assetSceneBody.parse(body);
    const [row] = await db
      .insert(assets)
      .values({ ...input, editorType: 'scene_editor' })
      .returning();
    set.status = 201;
    return row;
  })
  .patch('/:id', async ({ params, body }) => {
    const input = assetSceneBody.partial().parse(body);
    const [row] = await db
      .update(assets)
      .set({ ...input, editorType: 'scene_editor', updatedAt: new Date() })
      .where(and(eq(assets.id, params.id), ONLY_SCENE))
      .returning();
    if (!row) throw new AppError('NOT_FOUND', 'Aset scene tidak ditemukan.', 404);
    return row;
  })
  .delete('/:id', async ({ params }) => {
    const [row] = await db
      .delete(assets)
      .where(and(eq(assets.id, params.id), ONLY_SCENE))
      .returning();
    if (!row) throw new AppError('NOT_FOUND', 'Aset scene tidak ditemukan.', 404);
    return { ok: true };
  });
