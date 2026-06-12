import { SignJWT, jwtVerify } from 'jose';

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
    throw new Error('JWT_SECRET belum diset di environment.');
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
    const { payload } = await jwtVerify(token, getSecret());
    if (
      typeof payload.sub === 'string' &&
      typeof payload.sessionId === 'string' &&
      (payload.role === 'admin' || payload.role === 'user')
    ) {
      return { sub: payload.sub, sessionId: payload.sessionId, role: payload.role };
    }
    return null;
  } catch {
    return null;
  }
}
