import { Elysia } from 'elysia';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { db } from '../../db/client.ts';
import { creditPacks } from '../../db/schema/index.ts';
import { AppError } from '../../middleware/error.ts';
import { parseListQuery, buildOrderBy, setTotalCount } from '../../lib/admin-query.ts';

const PACK_COLUMNS = {
  name: creditPacks.name,
  code: creditPacks.code,
  credits: creditPacks.credits,
  createdAt: creditPacks.createdAt,
};

const packBody = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  credits: z.coerce.number().int().positive(),
  priceIdr: z.union([z.string(), z.number()]).transform(String),
  priceUsd: z.union([z.string(), z.number()]).transform(String),
  enabled: z.boolean().default(true),
});

/** CRUD credit packs untuk admin. */
export const creditPackAdminRoutes = new Elysia({ prefix: '/credit-packs' })
  .get('/', async ({ query, set }) => {
    const range = parseListQuery(query);
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(creditPacks);
    const rows = await db.query.creditPacks.findMany({
      orderBy: [buildOrderBy(range, PACK_COLUMNS, creditPacks.createdAt)],
      limit: range.limit,
      offset: range.offset,
    });
    setTotalCount(set, count);
    return rows;
  })
  .get('/:id', async ({ params }) => {
    const row = await db.query.creditPacks.findFirst({ where: eq(creditPacks.id, params.id) });
    if (!row) throw new AppError('NOT_FOUND', 'Credit pack tidak ditemukan.', 404);
    return row;
  })
  .post('/', async ({ body, set }) => {
    const input = packBody.parse(body);
    const [row] = await db.insert(creditPacks).values(input).returning();
    set.status = 201;
    return row;
  })
  .patch('/:id', async ({ params, body }) => {
    const input = packBody.partial().parse(body);
    const [row] = await db
      .update(creditPacks)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(creditPacks.id, params.id))
      .returning();
    if (!row) throw new AppError('NOT_FOUND', 'Credit pack tidak ditemukan.', 404);
    return row;
  })
  .delete('/:id', async ({ params }) => {
    const [row] = await db.delete(creditPacks).where(eq(creditPacks.id, params.id)).returning();
    if (!row) throw new AppError('NOT_FOUND', 'Credit pack tidak ditemukan.', 404);
    return { ok: true };
  });
