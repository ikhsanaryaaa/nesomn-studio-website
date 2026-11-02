import { parsePatch, publicMediaUrl } from '../../lib/validation.ts';
import { Elysia } from 'elysia';
import { z } from 'zod';
import { eq, sql, inArray } from 'drizzle-orm';
import { db } from '../../db/client.ts';
import { bundles, bundleItems, assets } from '../../db/schema/index.ts';
import { AppError } from '../../middleware/error.ts';
import { parseListQuery, buildOrderBy, setTotalCount } from '../../lib/admin-query.ts';

const BUNDLE_COLUMNS = {
  title: bundles.title,
  slug: bundles.slug,
  type: bundles.type,
  createdAt: bundles.createdAt,
};
const assetIdsSchema = z
  .array(z.string().uuid())
  .max(200)
  .transform((ids) => [...new Set(ids)]);
const bundleBody = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,199}$/),
  title: z.string().min(1),
  description: z.string().nullish(),
  type: z.enum(['preset', 'custom']).default('preset'),
  previews: z.array(publicMediaUrl).max(20).default([]),
  assetIds: assetIdsSchema.optional(),
});
const itemsBody = z.object({ assetIds: assetIdsSchema });
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function replaceItems(tx: Tx, id: string, ids: string[]) {
  const rows = await tx
    .select({ id: bundles.id })
    .from(bundles)
    .where(eq(bundles.id, id))
    .for('update');
  if (!rows.length) throw new AppError('NOT_FOUND', 'Bundle not found.', 404);
  if (ids.length) {
    const found = await tx
      .select({ id: assets.id })
      .from(assets)
      .where(inArray(assets.id, ids))
      .for('key share');
    if (found.length !== ids.length)
      throw new AppError('INVALID_ASSETS', 'Some bundle assets were not found.', 422);
  }
  await tx.delete(bundleItems).where(eq(bundleItems.bundleId, id));
  if (ids.length)
    await tx.insert(bundleItems).values(ids.map((assetId) => ({ bundleId: id, assetId })));
}
/** Read-only cross-editor selector; catalog mutation endpoints remain separate. */
export const bundleAssetOptionsRoutes = new Elysia({ prefix: '/bundle-assets' })
  .get('/', async ({ query, set }) => {
    const range = parseListQuery(query);
    const term = z
      .string()
      .trim()
      .max(120)
      .parse(query.title_like ?? '');
    const where = term ? sql`strpos(lower(${assets.title}),lower(${term}))>0` : undefined;
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(assets)
      .where(where);
    const rows = await db
      .select({ id: assets.id, title: assets.title, editorType: assets.editorType })
      .from(assets)
      .where(where)
      .orderBy(buildOrderBy(range, { title: assets.title }, assets.title))
      .limit(range.limit)
      .offset(range.offset);
    setTotalCount(set, count);
    return rows;
  })
  .get('/:id', async ({ params }) => {
    const [row] = await db
      .select({ id: assets.id, title: assets.title, editorType: assets.editorType })
      .from(assets)
      .where(eq(assets.id, z.string().uuid().parse(params.id)));
    if (!row) throw new AppError('NOT_FOUND', 'Asset not found.', 404);
    return row;
  });

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
    if (!row) throw new AppError('NOT_FOUND', 'Bundle not found.', 404);
    const items = await db.query.bundleItems.findMany({
      where: eq(bundleItems.bundleId, params.id),
    });
    return { ...row, assetIds: items.map((i) => i.assetId) };
  })
  .post('/', async ({ body, set }) => {
    const { assetIds = [], ...values } = bundleBody.parse(body);
    const row = await db.transaction(async (tx) => {
      const [bundle] = await tx.insert(bundles).values(values).returning();
      await replaceItems(tx, bundle!.id, assetIds);
      return { ...bundle!, assetIds };
    });
    set.status = 201;
    return row;
  })
  .patch('/:id', async ({ params, body }) => {
    const { assetIds, ...values } = parsePatch(bundleBody, body);
    return db.transaction(async (tx) => {
      const [row] = await tx
        .update(bundles)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(bundles.id, params.id))
        .returning();
      if (!row) throw new AppError('NOT_FOUND', 'Bundle not found.', 404);
      if (assetIds !== undefined) await replaceItems(tx, row.id, assetIds);
      const items = await tx.query.bundleItems.findMany({
        where: eq(bundleItems.bundleId, row.id),
      });
      return { ...row, assetIds: items.map((i) => i.assetId) };
    });
  })
  .delete('/:id', async ({ params }) => {
    const [row] = await db.delete(bundles).where(eq(bundles.id, params.id)).returning();
    if (!row) throw new AppError('NOT_FOUND', 'Bundle not found.', 404);
    return { ok: true };
  })
  .put('/:id/items', async ({ params, body }) => {
    const id = z.string().uuid().parse(params.id);
    const { assetIds } = itemsBody.parse(body);
    await db.transaction((tx) => replaceItems(tx, id, assetIds));
    return { ok: true, count: assetIds.length };
  });
