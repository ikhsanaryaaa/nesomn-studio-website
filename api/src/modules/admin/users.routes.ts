import { Elysia } from 'elysia';
import { eq, sql, desc, and } from 'drizzle-orm';
import { db } from '../../db/client.ts';
import { users, subscriptions, creditLedger, plans } from '../../db/schema/index.ts';
import { AppError } from '../../middleware/error.ts';
import { parseListQuery, buildOrderBy, setTotalCount } from '../../lib/admin-query.ts';

const USER_COLUMNS = {
  email: users.email,
  name: users.name,
  role: users.role,
  createdAt: users.createdAt,
};

/** Hitung saldo credit user = delta terakhir (balanceAfter) atau 0. */
async function creditBalance(userId: string): Promise<number> {
  const [last] = await db
    .select({ balance: creditLedger.balanceAfter })
    .from(creditLedger)
    .where(eq(creditLedger.userId, userId))
    .orderBy(desc(creditLedger.createdAt))
    .limit(1);
  return last?.balance ?? 0;
}

/** Ambil langganan aktif user (bila ada). */
async function activeSubscription(userId: string) {
  return db.query.subscriptions.findFirst({
    where: and(eq(subscriptions.userId, userId), eq(subscriptions.status, 'active')),
    orderBy: [desc(subscriptions.createdAt)],
  });
}

/** List & detail user untuk admin (read-only di sini; mutasi via modul lain). */
export const userAdminRoutes = new Elysia({ prefix: '/users' })
  .get('/', async ({ query, set }) => {
    const range = parseListQuery(query);
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
    const rows = await db.query.users.findMany({
      orderBy: [buildOrderBy(range, USER_COLUMNS, users.createdAt)],
      limit: range.limit,
      offset: range.offset,
    });
    const enriched = await Promise.all(
      rows.map(async (u) => {
        const sub = await activeSubscription(u.id);
        const plan = sub ? await db.query.plans.findFirst({ where: eq(plans.id, sub.planId) }) : null;
        return {
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          createdAt: u.createdAt,
          activePlan: plan?.name ?? null,
          creditBalance: await creditBalance(u.id),
        };
      }),
    );
    setTotalCount(set, count);
    return enriched;
  })
  .get('/:id', async ({ params }) => {
    const u = await db.query.users.findFirst({ where: eq(users.id, params.id) });
    if (!u) throw new AppError('NOT_FOUND', 'User tidak ditemukan.', 404);
    const sub = await activeSubscription(u.id);
    const plan = sub ? await db.query.plans.findFirst({ where: eq(plans.id, sub.planId) }) : null;
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      avatarUrl: u.avatarUrl,
      emailVerified: u.emailVerified,
      createdAt: u.createdAt,
      activeSubscription: sub ?? null,
      activePlan: plan ?? null,
      creditBalance: await creditBalance(u.id),
    };
  });
