import { createInvoice } from '../billing/qris/service.ts';
import { Elysia } from 'elysia';
import { z } from 'zod';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client.ts';
import { assets, licenses } from '../../db/schema/index.ts';
import { AppError } from '../../middleware/error.ts';
import { authPlugin, type AuthUser } from '../../middleware/auth.ts';
import { computeBundlePrice } from '../catalog/pricing.ts';
import { withUserTransaction } from '../../db/transaction.ts';
import { getStorage } from '../../lib/storage/index.ts';

/**
 * Store API (butuh auth): harga bundle, claim aset gratis, checkout draft,
 * Asset Library, dan download berlisensi. Settle pembayaran ditunda ke M8;
 * di sini item berbayar hanya membuat order berstatus `pending`.
 */

const idsBody = z.object({
  assetIds: z
    .array(z.string().uuid())
    .min(1)
    .max(50)
    .refine((ids) => new Set(ids).size === ids.length),
});

/** Ambil harga unit aset dari DB (number, dari kolom numeric string). */
async function priceItems(assetIds: string[]) {
  const rows = await db.query.assets.findMany({
    where: inArray(assets.id, assetIds),
  });
  if (
    rows.length !== assetIds.length ||
    rows.some((a) => a.status !== 'published' || !a.isMarketplace)
  )
    throw new AppError('NOT_FOUND', 'Sebagian aset tidak tersedia.', 404);
  return rows.map((a) => ({
    id: a.id,
    priceIdr: Number(a.priceIdr),
    priceUsd: Number(a.priceUsd),
  }));
}

export const storeRoutes = new Elysia({ prefix: '/store' })
  .use(authPlugin)
  // Hitung harga bundle custom (server-side, jangan percaya client).
  .post(
    '/bundle/price',
    async ({ body }) => {
      const { assetIds } = idsBody.parse(body);
      const items = await priceItems(assetIds);
      return computeBundlePrice(items);
    },
    { requireAuth: true },
  )
  // Claim aset gratis: grant license instan (idempotent). Aset berbayar ditolak.
  .post(
    '/assets/:id/claim',
    async ({ params, user }) => {
      const u = user as AuthUser;
      const asset = await db.query.assets.findFirst({ where: eq(assets.id, params.id) });
      if (!asset || asset.status !== 'published' || !asset.isMarketplace)
        throw new AppError('NOT_FOUND', 'Aset tidak ditemukan.', 404);
      if (asset.tier !== 'free' || Number(asset.priceIdr) !== 0 || Number(asset.priceUsd) !== 0) {
        throw new AppError('PAYMENT_REQUIRED', 'Aset ini berbayar. Checkout menyusul di M8.', 402);
      }
      return withUserTransaction(u.id, async (tx) => {
        await tx
          .insert(licenses)
          .values({ userId: u.id, assetId: asset.id, fileKey: asset.fileKey ?? asset.glbFile })
          .onConflictDoNothing();
        return tx.query.licenses.findFirst({
          where: and(eq(licenses.userId, u.id), eq(licenses.assetId, asset.id)),
        });
      });
    },
    { requireAuth: true },
  )
  // Checkout draft: buat order pending untuk item berbayar (tanpa settle).
  .post(
    '/checkout',
    async ({ body, user, request }) => {
      const { assetIds } = idsBody.parse(body);
      return createInvoice(
        (user as AuthUser).id,
        { type: assetIds.length > 1 ? 'bundle' : 'asset', gateway: 'qris', assetIds },
        request.headers.get('idempotency-key') ?? '',
      );
    },
    { requireAuth: true },
  )
  // Asset Library: aset yang dimiliki user (punya license).
  .get(
    '/library',
    async ({ user }) => {
      const u = user as AuthUser;
      const owned = await db.query.licenses.findMany({
        where: eq(licenses.userId, u.id),
      });
      const ids = owned.map((l) => l.assetId);
      if (!ids.length) return [];
      const rows = await db.query.assets.findMany({ where: inArray(assets.id, ids) });
      return rows.map((a) => ({
        id: a.id,
        slug: a.slug,
        title: a.title,
        type: a.type,
        previews: a.previews,
      }));
    },
    { requireAuth: true },
  )
  // Download berlisensi: validasi license, kembalikan signed URL ber-TTL.
  .get(
    '/assets/:id/download',
    async ({ params, user }) => {
      const u = user as AuthUser;
      const lic = await db.query.licenses.findFirst({
        where: and(eq(licenses.userId, u.id), eq(licenses.assetId, params.id)),
      });
      if (!lic) throw new AppError('FORBIDDEN', 'Anda belum memiliki aset ini.', 403);

      const asset = await db.query.assets.findFirst({ where: eq(assets.id, params.id) });
      const key = lic.fileKey ?? asset?.fileKey ?? asset?.glbFile;
      if (!key) throw new AppError('NOT_FOUND', 'File aset belum tersedia.', 404);

      const storage = await getStorage();
      const url = await storage.getSignedUrl(key);
      return { url };
    },
    { requireAuth: true },
  );
