import { Elysia } from 'elysia';
import { z } from 'zod';
import { eq, sql, desc } from 'drizzle-orm';
import { db } from '../../db/client.ts';
import { creditLedger } from '../../db/schema/index.ts';
import { writeAudit } from '../../lib/audit.ts';
import { parseListQuery, setTotalCount } from '../../lib/admin-query.ts';
import { authPlugin, type AuthUser } from '../../middleware/auth.ts';

const entryBody = z.object({
  userId: z.string().uuid(),
  delta: z.coerce.number().int().refine((n) => n !== 0, 'delta tidak boleh 0'),
  reason: z
    .enum(['subscription_grant', 'topup', 'usage', 'refund', 'admin_adjust'])
    .default('admin_adjust'),
});

/** Saldo terkini user = balanceAfter entri terbaru, atau 0. */
async function latestBalance(userId: string): Promise<number> {
  const [last] = await db
    .select({ balance: creditLedger.balanceAfter })
    .from(creditLedger)
    .where(eq(creditLedger.userId, userId))
    .orderBy(desc(creditLedger.createdAt))
    .limit(1);
  return last?.balance ?? 0;
}

/** Ledger credit: lihat riwayat, baca saldo, buat entri manual (admin). */
export const creditLedgerAdminRoutes = new Elysia({ prefix: '/credit-ledger' })
  .use(authPlugin)
  .get('/', async ({ query, set }) => {
    const range = parseListQuery(query);
    const filterUser = (query as Record<string, string | undefined>).userId;
    const where = filterUser ? eq(creditLedger.userId, filterUser) : undefined;
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(creditLedger)
      .where(where);
    const rows = await db.query.creditLedger.findMany({
      where,
      orderBy: [desc(creditLedger.createdAt)],
      limit: range.limit,
      offset: range.offset,
    });
    setTotalCount(set, count);
    return rows;
  })
  .get('/balance/:userId', async ({ params }) => {
    return { userId: params.userId, balance: await latestBalance(params.userId) };
  })
  // Buat entri manual; balanceAfter dihitung dari saldo terakhir + delta.
  .post('/', async ({ body, set, user }) => {
    const input = entryBody.parse(body);
    const current = await latestBalance(input.userId);
    const balanceAfter = current + input.delta;
    const [row] = await db
      .insert(creditLedger)
      .values({
        userId: input.userId,
        delta: input.delta,
        reason: input.reason,
        refType: 'admin',
        balanceAfter,
      })
      .returning();
    await writeAudit((user as AuthUser).id, 'credit_adjust', 'credit_ledger', row.id, {
      userId: input.userId,
      delta: input.delta,
      balanceAfter,
    });
    set.status = 201;
    return row;
  });
