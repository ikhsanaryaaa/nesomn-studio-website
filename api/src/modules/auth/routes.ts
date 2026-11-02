import { Elysia } from 'elysia';
import { eq, sql } from 'drizzle-orm';
import { clientIp } from '../../middleware/request-security.ts';
import { db } from '../../db/client.ts';
import { users } from '../../db/schema/index.ts';
import { hashPassword, verifyPassword } from '../../lib/password.ts';
import { signToken } from '../../lib/jwt.ts';
import { AppError } from '../../middleware/error.ts';
import { AUTH_COOKIE, authPlugin } from '../../middleware/auth.ts';
import { createSession } from '../session/service.ts';
import { beginGoogle, completeGoogle } from './google.ts';
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
  const ip = clientIp(request);
  return { userAgent, ip };
}

export const authRoutes = new Elysia({ prefix: '/auth' })
  .use(authPlugin)
  .get('/google', async ({ query, cookie, redirect }) => {
    const flow = await beginGoogle(query.returnTo);
    cookie.nesomn_oauth!.set({
      value: flow.cookie,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 600,
    });
    return redirect(flow.url);
  })
  .get('/google/callback', async ({ query, cookie, request, redirect }) => {
    const state = query.state,
      code = query.code,
      binding = cookie.nesomn_oauth?.value;
    cookie.nesomn_oauth!.remove();
    if (!state || !code || code.length > 4096 || typeof binding !== 'string')
      throw new AppError('INVALID_OAUTH', 'Google login could not be verified.', 401);
    let result;
    try {
      result = await completeGoogle(code, state, binding);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        'INVALID_OAUTH',
        'Google login could not be verified. Please start again.',
        401,
      );
    }
    const { user, returnPath } = result;
    const sessionId = await createSession(
      user.id,
      request.headers.get('user-agent'),
      clientIp(request),
    );
    const token = await signToken({ sub: user.id, sessionId, role: user.role });
    cookie[AUTH_COOKIE].set({ value: token, ...cookieOptions() });
    return redirect(
      new URL(returnPath, process.env.CLIENT_URL ?? 'http://localhost:5173').toString(),
    );
  })
  .post('/register', async ({ body, cookie, request, set }) => {
    const input = registerSchema.parse(body);

    const existing = await db.query.users.findFirst({
      where: sql`lower(${users.email}) = ${input.email.toLowerCase()}`,
    });
    if (existing) throw new AppError('EMAIL_TAKEN', 'This email is already registered.', 409);

    const passwordHash = await hashPassword(input.password);
    const [user] = await db
      .insert(users)
      .values({ email: input.email.toLowerCase(), passwordHash, name: input.name, role: 'user' })
      .onConflictDoNothing()
      .returning();
    if (!user) throw new AppError('EMAIL_TAKEN', 'This email is already registered.', 409);

    const { userAgent, ip } = clientInfo(request);
    const sessionId = await createSession(user.id, userAgent, ip);
    const token = await signToken({ sub: user.id, sessionId, role: user.role });
    cookie[AUTH_COOKIE].set({ value: token, ...cookieOptions() });

    set.status = 201;
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  })
  .post('/login', async ({ body, cookie, request }) => {
    const input = loginSchema.parse(body);

    const user = await db.query.users.findFirst({
      where: sql`lower(${users.email}) = ${input.email.toLowerCase()}`,
    });
    if (!user || user.disabledAt || !user.passwordHash) {
      throw new AppError('INVALID_CREDENTIALS', 'Incorrect email or password.', 401);
    }

    const ok = await verifyPassword(input.password, user.passwordHash);
    if (!ok) throw new AppError('INVALID_CREDENTIALS', 'Incorrect email or password.', 401);

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
