import { Elysia } from 'elysia';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { db } from '../../db/client.ts';
import { plans } from '../../db/schema/index.ts';
import { AppError } from '../../middleware/error.ts';
import { parseListQuery, buildOrderBy, setTotalCount } from '../../lib/admin-query.ts';

const PLAN_COLUMNS = {
  name: plans.name,
  code: plans.code,
  segment: plans.segment,
  cycle: plans.cycle,
  createdAt: plans.createdAt,
};

const editorAccess = z.object({
  scene2d: z.boolean(),
  editor3d: z.boolean(),
  proTemplates: z.boolean(),
  aiVideo: z.boolean(),
});

const planBody = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  segment: z.enum(['individual', 'team', 'enterprise']),
  cycle: z.enum(['monthly', 'yearly']),
  priceIdr: z.union([z.string(), z.number()]).transform(String).default('0'),
  priceUsd: z.union([z.string(), z.number()]).transform(String).default('0'),
  creditQuota: z.coerce.number().int().default(0),
  maxConcurrentSessions: z.coerce.number().int().nullish(),
  editorAccess,
  commercial: z.boolean().default(false),
  isEnterprise: z.boolean().default(false),
});

/** CRUD plans untuk admin. */
export const planAdminRoutes = new Elysia({ prefix: '/plans' })
  .get('/', async ({ query, set }) => {
    const range = parseListQuery(query);
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(plans);
    const rows = await db.query.plans.findMany({
      orderBy: [buildOrderBy(range, PLAN_COLUMNS, plans.createdAt)],
      limit: range.limit,
      offset: range.offset,
    });
    setTotalCount(set, count);
    return rows;
  })
  .get('/:id', async ({ params }) => {
    const row = await db.query.plans.findFirst({ where: eq(plans.id, params.id) });
    if (!row) throw new AppError('NOT_FOUND', 'Plan tidak ditemukan.', 404);
    return row;
  })
  .post('/', async ({ body, set }) => {
    const input = planBody.parse(body);
    const [row] = await db.insert(plans).values(input).returning();
    set.status = 201;
    return row;
  })
  .patch('/:id', async ({ params, body }) => {
    const input = planBody.partial().parse(body);
    const [row] = await db
      .update(plans)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(plans.id, params.id))
      .returning();
    if (!row) throw new AppError('NOT_FOUND', 'Plan tidak ditemukan.', 404);
    return row;
  })
  .delete('/:id', async ({ params }) => {
    const [row] = await db.delete(plans).where(eq(plans.id, params.id)).returning();
    if (!row) throw new AppError('NOT_FOUND', 'Plan tidak ditemukan.', 404);
    return { ok: true };
  });
