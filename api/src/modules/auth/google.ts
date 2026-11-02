import { createHash, randomBytes } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, type KeyLike } from 'jose';
import { z } from 'zod';
import { and, eq, sql, lt } from 'drizzle-orm';
import { db } from '../../db/client.ts';
import { oauthStates, users } from '../../db/schema/index.ts';
import { encryptSecret, decryptSecret } from '../../lib/crypto.ts';
import { AppError } from '../../middleware/error.ts';
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'), {
  timeoutDuration: 8000,
});
export function safeReturnPath(value?: string) {
  return [
    '/account',
    '/library',
    '/editor/projects',
    '/pricing',
    '/marketplace',
    '/editor/scene',
    '/editor/3d',
  ].includes(value ?? '')
    ? value!
    : '/account';
}
function configuration() {
  const clientId = process.env.GOOGLE_CLIENT_ID,
    secret = process.env.GOOGLE_CLIENT_SECRET,
    redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !secret || !redirectUri)
    throw new AppError('OAUTH_NOT_CONFIGURED', 'Google login is not configured.', 503);
  const url = new URL(redirectUri);
  if (
    (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !url.pathname.endsWith('/auth/google/callback')
  )
    throw new Error('Invalid Google redirect URI configuration');
  return { clientId, secret, redirectUri };
}
export async function beginGoogle(returnPath?: string) {
  const config = configuration();
  const state = randomBytes(32).toString('base64url'),
    cookie = randomBytes(32).toString('base64url'),
    verifier = randomBytes(32).toString('base64url'),
    nonce = randomBytes(32).toString('base64url');
  await db.delete(oauthStates).where(lt(oauthStates.expiresAt, new Date()));
  await db.insert(oauthStates).values({
    stateHash: digest(state),
    cookieHash: digest(cookie),
    verifierEncrypted: encryptSecret(verifier),
    nonce,
    returnPath: safeReturnPath(returnPath),
    expiresAt: new Date(Date.now() + 10 * 60000),
  });
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    nonce,
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
  }).toString();
  return { url: url.toString(), state, cookie };
}
export async function consumeGoogleState(state: string, cookie: string) {
  if (!/^[a-zA-Z0-9_-]{43}$/.test(state) || !cookie) throw new Error('Invalid OAuth state');
  // Wrong cookies cannot consume another browser's state. Single DELETE ... RETURNING is replay-safe.
  const [row] = await db
    .delete(oauthStates)
    .where(
      and(eq(oauthStates.stateHash, digest(state)), eq(oauthStates.cookieHash, digest(cookie))),
    )
    .returning();
  if (!row || row.expiresAt <= new Date()) throw new Error('OAuth state expired or replayed');
  return { ...row, verifier: decryptSecret(row.verifierEncrypted) };
}
const identitySchema = z.object({
  sub: z.string().min(1).max(255),
  email: z.string().email().max(254),
  email_verified: z.literal(true),
  nonce: z.string(),
  name: z.string().max(200).optional(),
  azp: z.string().optional(),
});
export async function verifyGoogleIdentity(
  token: string,
  nonce: string,
  clientId: string,
  key?: KeyLike,
) {
  const options = {
    algorithms: ['RS256'],
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: clientId,
  };
  const { payload } = key
    ? await jwtVerify(token, key, options)
    : await jwtVerify(token, googleKeys, options);
  const identity = identitySchema.parse(payload);
  if (
    (Array.isArray(payload.aud) && payload.aud.length > 1 && !identity.azp) ||
    identity.nonce !== nonce ||
    (identity.azp && identity.azp !== clientId)
  )
    throw new Error('Invalid Google nonce/authorized party');
  return identity;
}
export async function completeGoogle(code: string, state: string, cookie: string) {
  const config = configuration();
  const stored = await consumeGoogleState(state, cookie);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: config.clientId,
      client_secret: config.secret,
      redirect_uri: config.redirectUri,
      code_verifier: stored.verifier,
    }),
  });
  if (!res.ok) throw new Error('Google exchange failed');
  const data = z.object({ id_token: z.string().max(16000) }).parse(await res.json());
  const identity = await verifyGoogleIdentity(data.id_token, stored.nonce, config.clientId);
  const user = await db.transaction(async (tx) => {
    // Serialize identities across simultaneous callbacks without coupling to untrusted email.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${identity.sub},0))`);
    const existing = await tx.query.users.findFirst({ where: eq(users.googleId, identity.sub) });
    if (existing) {
      if (existing.disabledAt) throw new Error('Account disabled');
      return existing;
    }
    const email = identity.email.toLowerCase();
    const collision = await tx.query.users.findFirst({
      where: sql`lower(${users.email}) = ${email}`,
    });
    if (collision)
      throw new AppError(
        'ACCOUNT_LINK_REQUIRED',
        'This email is already registered. Log in using the existing account method. Account linking is not available.',
        409,
      );
    const [created] = await tx
      .insert(users)
      .values({
        email,
        name: identity.name ?? email.split('@')[0]!,
        googleId: identity.sub,
        emailVerified: true,
        role: 'user',
      })
      .returning();
    return created!;
  });
  return { user, returnPath: safeReturnPath(stored.returnPath) };
}
