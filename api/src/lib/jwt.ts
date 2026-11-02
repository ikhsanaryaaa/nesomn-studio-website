import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';

/**
 * Helper JWT untuk sesi auth. Payload minimal: sub (userId),
 * sessionId, role. Token disimpan di httpOnly cookie (bukan localStorage).
 */

export type TokenPayload = {
  sub: string;
  sessionId: string;
  role: 'admin' | 'user';
};

const TOKEN_TTL = '7d';

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set in the environment.');
  }
  return new TextEncoder().encode(secret);
}

export async function signToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] });
    if (
      Number.isSafeInteger(payload.exp) &&
      Number.isSafeInteger(payload.iat) &&
      z.string().uuid().safeParse(payload.sub).success &&
      z.string().uuid().safeParse(payload.sessionId).success &&
      (payload.role === 'admin' || payload.role === 'user')
    ) {
      return {
        sub: payload.sub as string,
        sessionId: payload.sessionId as string,
        role: payload.role,
      };
    }
    return null;
  } catch {
    return null;
  }
}
