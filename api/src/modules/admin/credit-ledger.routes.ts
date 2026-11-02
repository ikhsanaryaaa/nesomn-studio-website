import { Elysia } from 'elysia';
import { z } from 'zod';
import { eq, sql, desc } from 'drizzle-orm';
import { db } from '../../db/client.ts';
import { creditLedger } from '../../db/schema/index.ts';
import { adjustCredit, getBalance } from '../ai/credit.ts';
import { AppError } from '../../middleware/error.ts';
import { writeAudit } from '../../lib/audit.ts';
import { parseListQuery, setTotalCount } from '../../lib/admin-query.ts';
import { authPlugin, type AuthUser } from '../../middleware/auth.ts';

const entryBody = z.object({
  userId: z.string().uuid(),
  delta: z.coerce
    .number()
    .int()
    .refine((n) => n !== 0, 'delta tidak boleh 0'),
  reason: z.enum(['admin_adjust']).default('admin_adjust'),
});

/** Saldo terkini user = balanceAfter entri terbaru, atau 0. */
const latestBalance = getBalance;

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
  .post('/', async ({ body, set, user, request }) => {
    const input = entryBody.parse(body);
    const key = request.headers.get('idempotency-key');
    if (!key || !/^[a-zA-Z0-9_.-]{1,128}$/.test(key))
      throw new AppError('BAD_REQUEST', 'Idempotency-Key wajib untuk penyesuaian credit.', 400);
    const balanceAfter = await adjustCredit(
      input.userId,
      input.delta,
      'admin:' + (user as AuthUser).id + ':' + key,
    );
    const row = await db.query.creditLedger.findFirst({
      where: eq(
        creditLedger.operationKey,
        input.userId + ':' + 'admin_adjust:' + 'admin:' + (user as AuthUser).id + ':' + key,
      ),
    });
    if (!row) throw new Error('Adjustment entry unavailable');
    await writeAudit((user as AuthUser).id, 'credit_adjust', 'credit_ledger', row.id, {
      userId: input.userId,
      delta: input.delta,
      balanceAfter,
    });
    set.status = 201;
    return row;
  });
