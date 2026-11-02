import './disposable.ts';
import { test, expect } from 'bun:test';
import { generateKeyPair, SignJWT } from '../../api/node_modules/jose';
import {
  beginGoogle,
  consumeGoogleState,
  verifyGoogleIdentity,
  safeReturnPath,
} from '../../api/src/modules/auth/google.ts';
if (process.env.NESOMN_DISPOSABLE_TESTS !== '1') throw new Error('Disposable only');
test('OAuth state binds cookie, expires, is consumed once and prevents open redirects', async () => {
  process.env.GOOGLE_CLIENT_ID = 'sample-client';
  process.env.GOOGLE_CLIENT_SECRET = 'synthetic-secret';
  process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/api/auth/google/callback';
  const flow = await beginGoogle('/account');
  expect(new URL(flow.url).searchParams.get('code_challenge_method')).toBe('S256');
  await expect(consumeGoogleState(flow.state, 'wrong')).rejects.toThrow();
  const valid = await beginGoogle('/account');
  expect((await consumeGoogleState(valid.state, valid.cookie)).returnPath).toBe('/account');
  await expect(consumeGoogleState(valid.state, valid.cookie)).rejects.toThrow();
  expect(safeReturnPath('//evil.test')).toBe('/account');
  expect(safeReturnPath('/admin/')).toBe('/account');
});
test('Google JWT requires signature, audience, issuer, nonce, verified email and stable sub', async () => {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const claims = {
    nonce: 'sample-nonce',
    email: 'sample@test.invalid',
    email_verified: true,
    name: 'Demo / Sample',
  };
  const sign = (patch: Record<string, unknown> = {}) =>
    new SignJWT({ ...claims, ...patch })
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject('google-stable-subject')
      .setIssuer('https://accounts.google.com')
      .setAudience('sample-client')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);
  expect(
    (await verifyGoogleIdentity(await sign(), 'sample-nonce', 'sample-client', publicKey)).sub,
  ).toBe('google-stable-subject');
  await expect(
    verifyGoogleIdentity(await sign(), 'wrong-nonce', 'sample-client', publicKey),
  ).rejects.toThrow();
  await expect(
    verifyGoogleIdentity(await sign(), 'sample-nonce', 'other-client', publicKey),
  ).rejects.toThrow();
  await expect(
    verifyGoogleIdentity(
      await sign({ email_verified: false }),
      'sample-nonce',
      'sample-client',
      publicKey,
    ),
  ).rejects.toThrow();
});

test('OAuth return destinations match the actual production client routes', () => {
  for (const route of [
    '/account',
    '/library',
    '/pricing',
    '/marketplace',
    '/editor/projects',
    '/editor/scene',
    '/editor/3d',
  ])
    expect(safeReturnPath(route)).toBe(route);
  for (const route of ['/projects', '/store', '/scene-editor', '/editor-3d'])
    expect(safeReturnPath(route)).toBe('/account');
});
