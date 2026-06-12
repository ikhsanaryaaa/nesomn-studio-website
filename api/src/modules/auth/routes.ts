import { Elysia } from 'elysia';
import { eq } from 'drizzle-orm';
import { db } from '../../db/client.ts';
import { users } from '../../db/schema/index.ts';
import { hashPassword, verifyPassword } from '../../lib/password.ts';
import { signToken } from '../../lib/jwt.ts';
import { AppError } from '../../middleware/error.ts';
import { AUTH_COOKIE, authPlugin } from '../../middleware/auth.ts';
import { createSession } from '../session/service.ts';
import { registerSchema, loginSchema } from './schema.ts';

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 hari (detik)
const isProd = process.env.NODE_ENV === 'production';

/** Opsi cookie httpOnly untuk token sesi. */
function cookieOptions() {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  };
}

/** Ekstrak user-agent & IP dari request untuk pencatatan sesi. */
function clientInfo(request: Request): { userAgent: string | null; ip: string | null } {
  const userAgent = request.headers.get('user-agent');
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    null;
  return { userAgent, ip };
}

export const authRoutes = new Elysia({ prefix: '/auth' })
  .use(authPlugin)
  .post('/register', async ({ body, cookie, request, set }) => {
    const input = registerSchema.parse(body);

    const existing = await db.query.users.findFirst({ where: eq(users.email, input.email) });
    if (existing) throw new AppError('EMAIL_TAKEN', 'Email sudah terdaftar.', 409);

    const passwordHash = await hashPassword(input.password);
    const [user] = await db
      .insert(users)
      .values({ email: input.email, passwordHash, name: input.name, role: 'user' })
      .returning();

    const { userAgent, ip } = clientInfo(request);
    const sessionId = await createSession(user.id, userAgent, ip);
    const token = await signToken({ sub: user.id, sessionId, role: user.role });
    cookie[AUTH_COOKIE].set({ value: token, ...cookieOptions() });

    set.status = 201;
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  })
  .post('/login', async ({ body, cookie, request }) => {
    const input = loginSchema.parse(body);

    const user = await db.query.users.findFirst({ where: eq(users.email, input.email) });
    if (!user || !user.passwordHash) {
      throw new AppError('INVALID_CREDENTIALS', 'Email atau password salah.', 401);
    }

    const ok = await verifyPassword(input.password, user.passwordHash);
    if (!ok) throw new AppError('INVALID_CREDENTIALS', 'Email atau password salah.', 401);

    const { userAgent, ip } = clientInfo(request);
    const sessionId = await createSession(user.id, userAgent, ip);
    const token = await signToken({ sub: user.id, sessionId, role: user.role });
    cookie[AUTH_COOKIE].set({ value: token, ...cookieOptions() });

    return { id: user.id, email: user.email, name: user.name, role: user.role };
  })
  .post(
    '/logout',
    async ({ cookie, sessionId }) => {
      if (sessionId) {
        const { sessions } = await import('../../db/schema/index.ts');
        await db.delete(sessions).where(eq(sessions.id, sessionId));
      }
      cookie[AUTH_COOKIE].remove();
      return { ok: true };
    },
    { requireAuth: true },
  );
