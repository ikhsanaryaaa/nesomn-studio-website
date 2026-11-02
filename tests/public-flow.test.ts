import { expect, test } from 'bun:test';
import { safeReturnTo } from '../client/src/lib/public-flow.ts';
test('return redirect accepts only app paths and rejects external, auth loops, controls and encoded bypass', () => {
  expect(safeReturnTo('/bundle-builder?source=login')).toBe('/bundle-builder?source=login');
  for (const path of [
    'https://evil.invalid',
    '//evil.invalid',
    '/\\evil.invalid',
    '/%2f%2fevil.invalid',
    '/login',
    '/register?returnTo=/login',
    '/api/auth/logout',
    '/admin/',
    '/x\n',
  ])
    expect(safeReturnTo(path)).toBe('/account');
});
