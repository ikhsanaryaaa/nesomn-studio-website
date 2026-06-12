import { Elysia } from 'elysia';
import { and, eq, desc } from 'drizzle-orm';
import { db } from '../../db/client.ts';
import { sessions } from '../../db/schema/index.ts';
import { AppError } from '../../middleware/error.ts';
import { authPlugin } from '../../middleware/auth.ts';

/** Endpoint profil & manajemen sesi milik user (semua butuh auth). */
export const userRoutes = new Elysia()
  .use(authPlugin)
  .get('/me', ({ user }) => user, { requireAuth: true })
  .get(
    '/sessions',
    async ({ user }) => {
      const rows = await db.query.sessions.findMany({
        where: eq(sessions.userId, user!.id),
        orderBy: [desc(sessions.lastSeenAt)],
      });
      return rows.map((s) => ({
        id: s.id,
        userAgent: s.userAgent,
        ipAddress: s.ipAddress,
        createdAt: s.createdAt,
        lastSeenAt: s.lastSeenAt,
        current: s.id === undefined ? false : undefined,
      }));
    },
    { requireAuth: true },
  )
  .delete(
    '/sessions/:id',
    async ({ user, params }) => {
      const target = await db.query.sessions.findFirst({
        where: and(eq(sessions.id, params.id), eq(sessions.userId, user!.id)),
      });
      if (!target) throw new AppError('NOT_FOUND', 'Sesi tidak ditemukan.', 404);

      await db.delete(sessions).where(eq(sessions.id, params.id));
      return { ok: true };
    },
    { requireAuth: true },
  );
