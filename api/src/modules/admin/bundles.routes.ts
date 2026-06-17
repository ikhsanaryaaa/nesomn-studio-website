import { Elysia } from 'elysia';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { db } from '../../db/client.ts';
import { bundles, bundleItems } from '../../db/schema/index.ts';
import { AppError } from '../../middleware/error.ts';
import { parseListQuery, buildOrderBy, setTotalCount } from '../../lib/admin-query.ts';

const BUNDLE_COLUMNS = {
  title: bundles.title,
  slug: bundles.slug,
  type: bundles.type,
  createdAt: bundles.createdAt,
};

const bundleBody = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullish(),
  type: z.enum(['preset', 'custom']).default('preset'),
  previews: z.array(z.string()).default([]),
});

const itemsBody = z.object({ assetIds: z.array(z.string().uuid()) });

/** CRUD bundles + kelola bundle_items untuk admin. */
export const bundleAdminRoutes = new Elysia({ prefix: '/bundles' })
  .get('/', async ({ query, set }) => {
    const range = parseListQuery(query);
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(bundles);
    const rows = await db.query.bundles.findMany({
      orderBy: [buildOrderBy(range, BUNDLE_COLUMNS, bundles.createdAt)],
      limit: range.limit,
      offset: range.offset,
    });
    setTotalCount(set, count);
    return rows;
  })
  .get('/:id', async ({ params }) => {
    const row = await db.query.bundles.findFirst({ where: eq(bundles.id, params.id) });
    if (!row) throw new AppError('NOT_FOUND', 'Bundle tidak ditemukan.', 404);
    const items = await db.query.bundleItems.findMany({
      where: eq(bundleItems.bundleId, params.id),
    });
    return { ...row, assetIds: items.map((i) => i.assetId) };
  })
  .post('/', async ({ body, set }) => {
    const input = bundleBody.parse(body);
    const [row] = await db.insert(bundles).values(input).returning();
    set.status = 201;
    return row;
  })
  .patch('/:id', async ({ params, body }) => {
    const input = bundleBody.partial().parse(body);
    const [row] = await db
      .update(bundles)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(bundles.id, params.id))
      .returning();
    if (!row) throw new AppError('NOT_FOUND', 'Bundle tidak ditemukan.', 404);
    return row;
  })
  .delete('/:id', async ({ params }) => {
    const [row] = await db.delete(bundles).where(eq(bundles.id, params.id)).returning();
    if (!row) throw new AppError('NOT_FOUND', 'Bundle tidak ditemukan.', 404);
    return { ok: true };
  })
  // Ganti seluruh isi bundle dengan daftar asset baru (replace-set).
  .put('/:id/items', async ({ params, body }) => {
    const { assetIds } = itemsBody.parse(body);
    await db.delete(bundleItems).where(eq(bundleItems.bundleId, params.id));
    if (assetIds.length > 0) {
      await db
        .insert(bundleItems)
        .values(assetIds.map((assetId) => ({ bundleId: params.id, assetId })));
    }
    return { ok: true, count: assetIds.length };
  });
