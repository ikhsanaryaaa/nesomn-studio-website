import { Elysia } from 'elysia';
import { sql, desc } from 'drizzle-orm';
import { db } from '../../db/client.ts';
import { auditLogs } from '../../db/schema/index.ts';
import { parseListQuery, setTotalCount } from '../../lib/admin-query.ts';

/** Viewer audit log read-only (tidak ada create/update/delete dari UI). */
export const auditLogAdminRoutes = new Elysia({ prefix: '/audit-logs' })
  .get('/', async ({ query, set }) => {
    const range = parseListQuery(query);
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(auditLogs);
    const rows = await db.query.auditLogs.findMany({
      orderBy: [desc(auditLogs.createdAt)],
      limit: range.limit,
      offset: range.offset,
    });
    setTotalCount(set, count);
    return rows;
  });
