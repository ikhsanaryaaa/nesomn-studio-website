import { readFile } from 'node:fs/promises';
import { eq, sql } from 'drizzle-orm';
import { db } from './client.ts';
import {
  portfolioWorks,
  portfolioGallery,
  portfolioUploads,
  media,
  users,
  auditLogs,
} from './schema/index.ts';
import { getStorage } from '../lib/storage/index.ts';
import { validatePortfolioUpload } from '../modules/portfolio/upload.ts';
import { workBody, validateWork } from '../modules/portfolio/schema.ts';
import { sql as connection } from './client.ts';
if (
  Bun.argv.slice(2).join(' ') !== '--confirm-sample' ||
  !process.env.DATABASE_URL ||
  !process.env.SAMPLE_WORK_ADMIN_EMAIL
)
  throw Error('Explicit --confirm-sample, DATABASE_URL and SAMPLE_WORK_ADMIN_EMAIL required.');
const base = new URL('../../../client/dist/demo/portfolio/studio-kit/', import.meta.url);
const storage = await getStorage(),
  created: string[] = [];
try {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', base), 'utf8'));
  const result = await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended('nesomn-studio-kit-sample',0))`,
    );
    const [actor] = await tx
      .select()
      .from(users)
      .where(sql`lower(${users.email})=${process.env.SAMPLE_WORK_ADMIN_EMAIL!.toLowerCase()}`);
    if (!actor || actor.role !== 'admin' || actor.disabledAt)
      throw Error('An active existing administrator is required.');
    const [exists] = await tx
      .select()
      .from(portfolioWorks)
      .where(eq(portfolioWorks.slug, 'nesomn-studio-kit'));
    if (exists)
      return {
        status: 'SKIPPED',
        reason: 'Slug already exists; no content overwritten.',
        id: exists.id,
      };
    const ids = new Map<string, string>();
    for (const file of ['cover.png', 'artwork.png', 'packaging.png', 'motion.mp4']) {
      const bytes = await readFile(new URL(file, base)),
        checked = await validatePortfolioUpload(bytes, file, '');
      const key = 'portfolio/' + crypto.randomUUID() + '.' + file.split('.').pop();
      created.push(key);
      await storage.put(key, bytes, checked.mime);
      const [m] = await tx
        .insert(media)
        .values({
          key,
          ownerId: actor.id,
          mimeType: checked.mime,
          sizeBytes: bytes.length,
          width: checked.width,
          height: checked.height,
        })
        .returning();
      await tx.insert(portfolioUploads).values({ mediaId: m!.id, name: file });
      ids.set(file, m!.id);
    }
    const input = workBody.parse({
      slug: 'nesomn-studio-kit',
      title: manifest.title,
      description: manifest.description,
      projectDate: manifest.projectDate,
      client: null,
      isSample: true,
      status: 'published',
      coverMediaId: ids.get('cover.png'),
      linkLabel: manifest.linkLabel,
      linkUrl: manifest.linkUrl,
      gallery: manifest.gallery.map(
        (item: { media: { url: string }; alt: string; poster: { url: string } | null }) => ({
          mediaId: ids.get(item.media.url.split('/').pop()!),
          alt: item.alt,
          posterMediaId: item.poster ? ids.get(item.poster.url.split('/').pop()!) : null,
        }),
      ),
    });
    validateWork(input);
    const { gallery, ...fields } = input;
    const [work] = await tx.insert(portfolioWorks).values(fields).returning();
    await tx
      .insert(portfolioGallery)
      .values(gallery.map((item, position) => ({ ...item, workId: work!.id, position })));
    await tx
      .insert(auditLogs)
      .values({
        actorId: actor.id,
        action: 'portfolio.sample_import',
        targetType: 'portfolio_work',
        targetId: work!.id,
      });
    return { status: 'CREATED', id: work!.id, slug: work!.slug };
  });
  console.log(JSON.stringify(result));
} catch {
  for (const key of created) await storage.delete(key);
  console.error('Sample import failed. Check migrations, storage and the existing admin identity.');
  process.exitCode = 1;
} finally {
  await connection.end();
}
