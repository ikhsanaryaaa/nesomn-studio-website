import { Elysia } from 'elysia';
import { eq, sql, desc } from 'drizzle-orm';
import { db } from '../../db/client.ts';
import { sessions } from '../../db/schema/index.ts';
import { AppError } from '../../middleware/error.ts';
import { writeAudit } from '../../lib/audit.ts';
import { parseListQuery, setTotalCount } from '../../lib/admin-query.ts';
import { authPlugin, type AuthUser } from '../../middleware/auth.ts';

/** Viewer sesi aktif untuk admin + revoke. Filter opsional per userId. */
export const sessionAdminRoutes = new Elysia({ prefix: '/sessions' })
  .use(authPlugin)
  .get('/', async ({ query, set }) => {
    const range = parseListQuery(query);
    const filterUser = (query as Record<string, string | undefined>).userId;
    const where = filterUser ? eq(sessions.userId, filterUser) : undefined;
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(sessions)
      .where(where);
    const rows = await db.query.sessions.findMany({
      where,
      orderBy: [desc(sessions.lastSeenAt)],
      limit: range.limit,
      offset: range.offset,
    });
    setTotalCount(set, count);
    return rows;
  })
  .delete('/:id', async ({ params, user }) => {
    const [row] = await db.delete(sessions).where(eq(sessions.id, params.id)).returning();
    if (!row) throw new AppError('NOT_FOUND', 'Sesi tidak ditemukan.', 404);
    await writeAudit((user as AuthUser).id, 'revoke', 'session', row.id, {
      userId: row.userId,
    });
    return { ok: true };
  });
