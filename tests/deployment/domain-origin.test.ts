import { afterAll, expect, test } from 'bun:test';
import {
  isLandingCatalogRequest,
  assertRequestOrigin,
} from '../../api/src/middleware/request-security.ts';
const old = {
  landing: process.env.LANDING_URL,
  client: process.env.CLIENT_URL,
  admin: process.env.ADMIN_URL,
};
process.env.LANDING_URL = 'https://nesomn.studio';
process.env.CLIENT_URL = 'https://shop.nesomn.studio';
process.env.ADMIN_URL = 'https://dashboard.nesomn.studio';
afterAll(() => {
  for (const [key, value] of Object.entries({
    LANDING_URL: old.landing,
    CLIENT_URL: old.client,
    ADMIN_URL: old.admin,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
test('marketing may read catalogue only, shop/admin may mutate with explicit Origin', () => {
  const req = (path: string, origin: string, method = 'GET') =>
    new Request('https://api.nesomn.studio' + path, { method, headers: { origin } });
  expect(isLandingCatalogRequest(req('/catalog/assets', 'https://nesomn.studio'))).toBe(true);
  expect(isLandingCatalogRequest(req('/api/catalog/assets?q=font', 'https://nesomn.studio'))).toBe(
    true,
  );
  for (const path of ['/me', '/admin/users', '/catalog/assets/private'])
    expect(isLandingCatalogRequest(req(path, 'https://nesomn.studio'))).toBe(false);
  expect(isLandingCatalogRequest(req('/catalog/assets', 'https://evil.test'))).toBe(false);
  expect(() => assertRequestOrigin(req('/auth/login', 'https://nesomn.studio', 'POST'))).toThrow();
  expect(() =>
    assertRequestOrigin(req('/auth/login', 'https://shop.nesomn.studio', 'POST')),
  ).not.toThrow();
  expect(() =>
    assertRequestOrigin(req('/admin/users', 'https://dashboard.nesomn.studio', 'POST')),
  ).not.toThrow();
});

test('marketing CORS includes published Works APIs but never portfolio admin mutation', () => {
  const old = process.env.LANDING_URL;
  process.env.LANDING_URL = 'https://nesomn.studio';
  try {
    for (const path of ['/works', '/works/studio-kit', '/works/media/' + crypto.randomUUID()])
      expect(
        isLandingCatalogRequest(
          new Request('https://api.nesomn.studio' + path, {
            headers: { origin: 'https://nesomn.studio' },
          }),
        ),
      ).toBe(true);
    expect(
      isLandingCatalogRequest(
        new Request('https://api.nesomn.studio/admin/works', {
          headers: { origin: 'https://nesomn.studio' },
        }),
      ),
    ).toBe(false);
  } finally {
    if (old === undefined) delete process.env.LANDING_URL;
    else process.env.LANDING_URL = old;
  }
});
