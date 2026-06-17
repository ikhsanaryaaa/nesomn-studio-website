import { Elysia } from 'elysia';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { db } from '../../db/client.ts';
import { subscriptions, plans } from '../../db/schema/index.ts';
import { AppError } from '../../middleware/error.ts';
import { writeAudit } from '../../lib/audit.ts';
import { parseListQuery, buildOrderBy, setTotalCount } from '../../lib/admin-query.ts';
import { authPlugin, type AuthUser } from '../../middleware/auth.ts';

const SUB_COLUMNS = {
  status: subscriptions.status,
  segment: subscriptions.segment,
  cycle: subscriptions.cycle,
  createdAt: subscriptions.createdAt,
};

const attachBody = z.object({
  userId: z.string().uuid(),
  planId: z.string().uuid(),
  status: z.enum(['active', 'canceled', 'expired', 'pending']).default('active'),
  periodDays: z.coerce.number().int().positive().default(30),
});

/** Manajemen langganan manual oleh admin (attach/cabut/atur status). */
export const subscriptionAdminRoutes = new Elysia({ prefix: '/subscriptions' })
  .use(authPlugin)
  .get('/', async ({ query, set }) => {
    const range = parseListQuery(query);
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(subscriptions);
    const rows = await db.query.subscriptions.findMany({
      orderBy: [buildOrderBy(range, SUB_COLUMNS, subscriptions.createdAt)],
      limit: range.limit,
      offset: range.offset,
    });
    setTotalCount(set, count);
    return rows;
  })
  .get('/:id', async ({ params }) => {
    const row = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.id, params.id),
    });
    if (!row) throw new AppError('NOT_FOUND', 'Langganan tidak ditemukan.', 404);
    return row;
  })
  // Attach plan ke user (buat langganan baru). Periode dihitung dari sekarang.
  .post('/', async ({ body, set, user }) => {
    const input = attachBody.parse(body);
    const plan = await db.query.plans.findFirst({ where: eq(plans.id, input.planId) });
    if (!plan) throw new AppError('NOT_FOUND', 'Plan tidak ditemukan.', 404);

    const start = new Date();
    const end = new Date(start.getTime() + input.periodDays * 24 * 60 * 60 * 1000);
    const [row] = await db
      .insert(subscriptions)
      .values({
        userId: input.userId,
        planId: input.planId,
        status: input.status,
        cycle: plan.cycle,
        segment: plan.segment,
        gateway: 'manual',
        currentPeriodStart: start,
        currentPeriodEnd: end,
      })
      .returning();
    await writeAudit((user as AuthUser).id, 'attach', 'subscription', row.id, {
      userId: input.userId,
      planId: input.planId,
    });
    set.status = 201;
    return row;
  })
  // Ubah status (mis. cabut = canceled).
  .patch('/:id', async ({ params, body, user }) => {
    const patch = z
      .object({ status: z.enum(['active', 'canceled', 'expired', 'pending']) })
      .parse(body);
    const [row] = await db
      .update(subscriptions)
      .set({ status: patch.status, updatedAt: new Date() })
      .where(eq(subscriptions.id, params.id))
      .returning();
    if (!row) throw new AppError('NOT_FOUND', 'Langganan tidak ditemukan.', 404);
    await writeAudit((user as AuthUser).id, 'update', 'subscription', row.id, {
      status: patch.status,
    });
    return row;
  });
