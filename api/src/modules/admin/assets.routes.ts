import { Elysia } from 'elysia';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { db } from '../../db/client.ts';
import { assets } from '../../db/schema/index.ts';
import { AppError } from '../../middleware/error.ts';
import { parseListQuery, buildOrderBy, setTotalCount } from '../../lib/admin-query.ts';

const ASSET_COLUMNS = {
  title: assets.title,
  slug: assets.slug,
  type: assets.type,
  tier: assets.tier,
  createdAt: assets.createdAt,
};

const assetBody = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullish(),
  type: z.enum(['font', 'mockup3d', 'mockup2d', 'asset3d', 'graphic', 'motion']),
  tier: z.enum(['free', 'pro']).default('free'),
  priceIdr: z.union([z.string(), z.number()]).transform(String).default('0'),
  priceUsd: z.union([z.string(), z.number()]).transform(String).default('0'),
  previews: z.array(z.string()).default([]),
  fileKey: z.string().nullish(),
  glbFile: z.string().nullish(),
  popular: z.boolean().default(false),
});

/** CRUD assets untuk admin (di bawah guard requireAdmin di barrel). */
export const assetAdminRoutes = new Elysia({ prefix: '/assets' })
  .get('/', async ({ query, set }) => {
    const range = parseListQuery(query);
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(assets);
    const rows = await db.query.assets.findMany({
      orderBy: [buildOrderBy(range, ASSET_COLUMNS, assets.createdAt)],
      limit: range.limit,
      offset: range.offset,
    });
    setTotalCount(set, count);
    return rows;
  })
  .get('/:id', async ({ params }) => {
    const row = await db.query.assets.findFirst({ where: eq(assets.id, params.id) });
    if (!row) throw new AppError('NOT_FOUND', 'Aset tidak ditemukan.', 404);
    return row;
  })
  .post('/', async ({ body, set }) => {
    const input = assetBody.parse(body);
    const [row] = await db.insert(assets).values(input).returning();
    set.status = 201;
    return row;
  })
  .patch('/:id', async ({ params, body }) => {
    const input = assetBody.partial().parse(body);
    const [row] = await db
      .update(assets)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(assets.id, params.id))
      .returning();
    if (!row) throw new AppError('NOT_FOUND', 'Aset tidak ditemukan.', 404);
    return row;
  })
  .delete('/:id', async ({ params }) => {
    const [row] = await db.delete(assets).where(eq(assets.id, params.id)).returning();
    if (!row) throw new AppError('NOT_FOUND', 'Aset tidak ditemukan.', 404);
    return { ok: true };
  });
