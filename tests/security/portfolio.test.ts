import './disposable.ts';
import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import sharp from '../../api/node_modules/sharp';
import { eq, inArray } from '../../api/node_modules/drizzle-orm';
import { app } from '../../api/src/index';
import { db } from '../../api/src/db/client';
import { users, media, portfolioWorks, portfolioUploads, auditLogs } from '../../api/src/db/schema';
import { createSession } from '../../api/src/modules/session/service';
import { signToken } from '../../api/src/lib/jwt';
import { getStorage } from '../../api/src/lib/storage';
test('portfolio role guards, publication/media isolation, ordered mixed gallery and concurrency', async () => {
  const people = await db
    .insert(users)
    .values([
      { email: crypto.randomUUID() + '@test.invalid', name: 'Portfolio test admin', role: 'admin' },
      { email: crypto.randomUUID() + '@test.invalid', name: 'Portfolio test user', role: 'user' },
    ])
    .returning();
  const [admin, user] = people;
  const cookie = async (person: typeof admin) =>
    'nesomn_session=' +
    (await signToken({
      sub: person.id,
      role: person.role,
      sessionId: await createSession(person.id, null, null),
    }));
  const adminCookie = await cookie(admin),
    userCookie = await cookie(user);
  const uploaded: string[] = [];
  let workId: string | undefined;
  const request = (path: string, method = 'GET', body?: unknown, auth = adminCookie) =>
    app.handle(
      new Request('http://localhost' + path, {
        method,
        headers: {
          ...(auth ? { cookie: auth } : {}),
          ...(body && !(body instanceof FormData) ? { 'content-type': 'application/json' } : {}),
        },
        body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
      }),
    );
  const upload = async (bytes: Uint8Array, name: string) => {
    const form = new FormData();
    form.append('file', new File([bytes], name));
    const r = await request('/admin/works/media', 'POST', form);
    expect(r.status).toBe(201);
    const item = await r.json();
    uploaded.push(item.id);
    return item;
  };
  try {
    expect((await request('/admin/works', 'GET', undefined, '')).status).toBe(401);
    expect(
      (await request('/admin/works', 'POST', { slug: 'no', title: 'No' }, userCookie)).status,
    ).toBe(403);
    const png = await sharp({
      create: { width: 12, height: 12, channels: 3, background: '#ff6600' },
    })
      .png()
      .toBuffer();
    const cover = await upload(png, 'cover.png'),
      second = await upload(png, 'second.png');
    const mp4 = await upload(await readFile('tests/fixtures/portfolio/sample.mp4'), 'sample.mp4');
    const webm = await upload(
      await readFile('tests/fixtures/portfolio/sample.webm'),
      'sample.webm',
    );
    expect((await request('/works/media/' + cover.id, 'GET', undefined, '')).status).toBe(404);
    expect(
      (await request('/admin/works/media/' + cover.id, 'GET', undefined, userCookie)).status,
    ).toBe(403);
    const privateFile = (
      await db
        .insert(media)
        .values({ key: 'private/' + crypto.randomUUID() + '.png', mimeType: 'image/png' })
        .returning()
    )[0];
    uploaded.push(privateFile.id);
    expect(
      (
        await request('/admin/works', 'POST', {
          slug: 'private-' + crypto.randomUUID(),
          title: 'Private source',
          coverMediaId: privateFile.id,
        })
      ).status,
    ).toBe(422);
    const slug = 'portfolio-' + crypto.randomUUID();
    const body = {
      slug,
      title: 'Portfolio integration sample',
      description: 'Original test fixture only.',
      client: null,
      projectDate: '2026-11-03',
      status: 'draft',
      isSample: true,
      coverMediaId: cover.id,
      linkLabel: 'Explore',
      linkUrl: 'https://nesomn.studio',
      gallery: [
        { mediaId: second.id, alt: 'Orange sample' },
        { mediaId: mp4.id, alt: 'Sample clip', posterMediaId: cover.id },
        { mediaId: webm.id, alt: 'WebM sample' },
      ],
    };
    const create = await request('/admin/works', 'POST', body);
    expect(create.status).toBe(201);
    let work = await create.json();
    workId = work.id;
    expect(work.gallery.map((x: { mediaId: string }) => x.mediaId)).toEqual([
      second.id,
      mp4.id,
      webm.id,
    ]);
    expect((await request('/works/' + slug, 'GET', undefined, '')).status).toBe(404);
    expect((await request('/works/media/' + mp4.id, 'GET', undefined, '')).status).toBe(404);
    const listing = await request('/admin/works?_start=0&_end=10');
    expect(Number(listing.headers.get('x-total-count'))).toBeGreaterThan(0);
    const publish = { ...body, status: 'published', expectedRevision: work.revision };
    const update = await request('/admin/works/' + workId, 'PUT', publish);
    expect(update.status).toBe(200);
    work = await update.json();
    expect(work.revision).toBe(2);
    const publicWork = await request('/works/' + slug, 'GET', undefined, '');
    expect(publicWork.status).toBe(200);
    const publicData = await publicWork.json();
    expect(JSON.stringify(publicData)).not.toContain('portfolio/');
    expect(publicData.cover.url).toContain('/api/works/media/');
    const playable = await request('/works/media/' + mp4.id, 'GET', undefined, '');
    expect(playable.status).toBe(302);
    const location = playable.headers.get('location')!;
    const part = await app.handle(
      new Request(new URL(location, 'http://localhost'), { headers: { range: 'bytes=0-15' } }),
    );
    expect(part.status).toBe(206);
    expect((await part.arrayBuffer()).byteLength).toBe(16);
    expect(part.headers.get('content-range')).toMatch(/^bytes 0-15\//);
    const invalid = await app.handle(
      new Request(new URL(location, 'http://localhost'), {
        headers: { range: 'bytes=999999999-' },
      }),
    );
    expect(invalid.status).toBe(416);
    const duplicate = await request('/admin/works', 'POST', body);
    expect(duplicate.status).toBe(409);
    expect((await duplicate.json()).error.code).toBe('SLUG_TAKEN');
    const changed = {
      ...body,
      status: 'published',
      gallery: [...body.gallery].reverse(),
      expectedRevision: work.revision,
    };
    const races = await Promise.all([
      request('/admin/works/' + workId, 'PUT', changed),
      request('/admin/works/' + workId, 'PUT', { ...changed, title: 'Concurrent title' }),
    ]);
    expect(races.map((r) => r.status).sort()).toEqual([200, 409]);
    const conflict = await races.find((r) => r.status === 409)!.json();
    expect(conflict.error.code).toBe('WORK_CONFLICT');
    work = await (await request('/admin/works/' + workId)).json();
    expect(work.gallery.map((x: { mediaId: string }) => x.mediaId)).toEqual([
      webm.id,
      mp4.id,
      second.id,
    ]);
    const draft = await request('/admin/works/' + workId, 'PUT', {
      ...body,
      status: 'draft',
      expectedRevision: work.revision,
    });
    expect(draft.status).toBe(200);
    expect((await request('/works/' + slug, 'GET', undefined, '')).status).toBe(404);
    expect((await request('/works/media/' + cover.id, 'GET', undefined, '')).status).toBe(404);
    expect((await request('/admin/works/' + workId, 'DELETE', undefined, userCookie)).status).toBe(
      403,
    );
    expect((await request('/admin/works/' + workId, 'DELETE')).status).toBe(200);
    workId = undefined;
  } finally {
    if (workId) await db.delete(portfolioWorks).where(eq(portfolioWorks.id, workId));
    if (uploaded.length) {
      const files = await db.select().from(media).where(inArray(media.id, uploaded));
      await db.delete(portfolioUploads).where(inArray(portfolioUploads.mediaId, uploaded));
      await db.delete(media).where(inArray(media.id, uploaded));
      for (const file of files) await (await getStorage()).delete(file.key);
    }
    await db.delete(auditLogs).where(eq(auditLogs.actorId, admin.id));
    await db.delete(users).where(
      inArray(
        users.id,
        people.map((p) => p.id),
      ),
    );
  }
}, 30000);
