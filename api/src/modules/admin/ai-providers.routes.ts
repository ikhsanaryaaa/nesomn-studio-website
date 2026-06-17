import { Elysia } from 'elysia';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { db } from '../../db/client.ts';
import { aiProviders } from '../../db/schema/index.ts';
import { AppError } from '../../middleware/error.ts';
import { encryptSecret, decryptSecret } from '../../lib/crypto.ts';
import { writeAudit } from '../../lib/audit.ts';
import { parseListQuery, buildOrderBy, setTotalCount } from '../../lib/admin-query.ts';
import { authPlugin, type AuthUser } from '../../middleware/auth.ts';

const PROVIDER_COLUMNS = {
  key: aiProviders.key,
  modelName: aiProviders.modelName,
  kind: aiProviders.kind,
  tab: aiProviders.tab,
  createdAt: aiProviders.createdAt,
};

const providerBody = z.object({
  key: z.string().min(1),
  kind: z.enum(['image', 'video']),
  modelName: z.string().min(1),
  apiKey: z.string().optional(),
  baseUrl: z.string().nullish(),
  enabled: z.boolean().default(true),
  creditCost: z.coerce.number().int().min(0).default(0),
  tab: z.enum(['scene', 'motion']),
  tierAccess: z.array(z.string()).default([]),
});

/** Sembunyikan apiKey: jangan pernah kirim mentah, cukup penanda. */
function maskProvider<T extends { apiKeyEncrypted: string | null }>(row: T) {
  const { apiKeyEncrypted, ...rest } = row;
  return { ...rest, hasApiKey: Boolean(apiKeyEncrypted), apiKeyMask: apiKeyEncrypted ? '••••••••' : null };
}

/** CRUD AI provider registry. apiKey terenkripsi & ter-mask. */
export const aiProviderAdminRoutes = new Elysia({ prefix: '/ai-providers' })
  .use(authPlugin)
  .get('/', async ({ query, set }) => {
    const range = parseListQuery(query);
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(aiProviders);
    const rows = await db.query.aiProviders.findMany({
      orderBy: [buildOrderBy(range, PROVIDER_COLUMNS, aiProviders.createdAt)],
      limit: range.limit,
      offset: range.offset,
    });
    setTotalCount(set, count);
    return rows.map(maskProvider);
  })
  .get('/:id', async ({ params }) => {
    const row = await db.query.aiProviders.findFirst({ where: eq(aiProviders.id, params.id) });
    if (!row) throw new AppError('NOT_FOUND', 'Provider tidak ditemukan.', 404);
    return maskProvider(row);
  })
  .post('/', async ({ body, set, user }) => {
    const input = providerBody.parse(body);
    const { apiKey, ...rest } = input;
    const [row] = await db
      .insert(aiProviders)
      .values({ ...rest, apiKeyEncrypted: apiKey ? encryptSecret(apiKey) : null })
      .returning();
    await writeAudit((user as AuthUser).id, 'create', 'ai_provider', row.id, { key: row.key });
    set.status = 201;
    return maskProvider(row);
  })
  .patch('/:id', async ({ params, body, user }) => {
    const input = providerBody.partial().parse(body);
    const { apiKey, ...rest } = input;
    const patch: Record<string, unknown> = { ...rest, updatedAt: new Date() };
    // Hanya timpa apiKey bila dikirim non-kosong (kosong = pertahankan lama).
    if (apiKey) patch.apiKeyEncrypted = encryptSecret(apiKey);
    const [row] = await db
      .update(aiProviders)
      .set(patch)
      .where(eq(aiProviders.id, params.id))
      .returning();
    if (!row) throw new AppError('NOT_FOUND', 'Provider tidak ditemukan.', 404);
    await writeAudit((user as AuthUser).id, 'update', 'ai_provider', row.id, {
      changed: Object.keys(rest),
      apiKeyRotated: Boolean(apiKey),
    });
    return maskProvider(row);
  })
  .delete('/:id', async ({ params, user }) => {
    const [row] = await db.delete(aiProviders).where(eq(aiProviders.id, params.id)).returning();
    if (!row) throw new AppError('NOT_FOUND', 'Provider tidak ditemukan.', 404);
    await writeAudit((user as AuthUser).id, 'delete', 'ai_provider', row.id, { key: row.key });
    return { ok: true };
  })
  // Test koneksi: dekripsi server-side, ping baseUrl. apiKey tidak ke browser.
  .post('/:id/test', async ({ params, user }) => {
    const row = await db.query.aiProviders.findFirst({ where: eq(aiProviders.id, params.id) });
    if (!row) throw new AppError('NOT_FOUND', 'Provider tidak ditemukan.', 404);
    if (!row.baseUrl) throw new AppError('NO_BASE_URL', 'baseUrl belum diisi.', 400);

    let ok = false;
    let detail = '';
    try {
      const apiKey = row.apiKeyEncrypted ? decryptSecret(row.apiKeyEncrypted) : '';
      const res = await fetch(row.baseUrl, {
        method: 'GET',
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        signal: AbortSignal.timeout(8000),
      });
      ok = res.ok || res.status === 401; // 401 = endpoint hidup, auth saja
      detail = `HTTP ${res.status}`;
    } catch (err) {
      detail = err instanceof Error ? err.message : 'gagal terhubung';
    }
    await writeAudit((user as AuthUser).id, 'test', 'ai_provider', row.id, { ok, detail });
    return { ok, detail };
  });
