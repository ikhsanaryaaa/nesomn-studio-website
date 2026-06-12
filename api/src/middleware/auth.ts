import { Elysia } from 'elysia';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { users, sessions } from '../db/schema/index.ts';
import { verifyToken } from '../lib/jwt.ts';
import { AppError } from './error.ts';

export const AUTH_COOKIE = 'nesomn_session';

/** Konteks user yang disuntik ke request terautentikasi. */
export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
};

/**
 * Plugin auth: membaca cookie JWT, verifikasi, dan menyediakan
 * `user`/`sessionId` (null bila anonim) plus guard requireAuth/requireAdmin.
 */
export const authPlugin = new Elysia({ name: 'auth' })
  .derive({ as: 'global' }, async ({ cookie }) => {
    const token = cookie[AUTH_COOKIE]?.value as string | undefined;
    if (!token) return { user: null as AuthUser | null, sessionId: null as string | null };

    const payload = await verifyToken(token);
    if (!payload) return { user: null as AuthUser | null, sessionId: null as string | null };

    // Pastikan sesi masih ada (belum logout/revoke).
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, payload.sessionId),
    });
    if (!session) return { user: null as AuthUser | null, sessionId: null as string | null };

    const user = await db.query.users.findFirst({ where: eq(users.id, payload.sub) });
    if (!user) return { user: null as AuthUser | null, sessionId: null as string | null };

    return {
      user: { id: user.id, email: user.email, name: user.name, role: user.role } as AuthUser,
      sessionId: session.id as string | null,
    };
  })
  .macro({
    requireAuth(enabled: boolean) {
      if (!enabled) return {};
      return {
        beforeHandle({ user }: { user: AuthUser | null }) {
          if (!user) throw new AppError('UNAUTHORIZED', 'Autentikasi diperlukan.', 401);
        },
      };
    },
    requireAdmin(enabled: boolean) {
      if (!enabled) return {};
      return {
        beforeHandle({ user }: { user: AuthUser | null }) {
          if (!user) throw new AppError('UNAUTHORIZED', 'Autentikasi diperlukan.', 401);
          if (user.role !== 'admin')
            throw new AppError('FORBIDDEN', 'Akses khusus admin.', 403);
        },
      };
    },
  });
