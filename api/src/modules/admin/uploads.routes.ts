import { Elysia } from 'elysia';
import sharp from 'sharp';
import { db } from '../../db/client.ts';
import { media } from '../../db/schema/index.ts';
import { AppError } from '../../middleware/error.ts';
import { getStorage } from '../../lib/storage/index.ts';

/**
 * Upload aset admin (multipart). Menyimpan original + thumbnail via storage
 * driver, mencatat baris `media`, dan mengembalikan key + URL preview.
 * Hanya dipakai di bawah guard requireAdmin (lihat admin/index.ts).
 */

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

/** Bersihkan nama file jadi key aman. */
function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
}

export const uploadAdminRoutes = new Elysia({ prefix: '/uploads' }).post(
  '/',
  async ({ body }) => {
    const file = (body as { file?: File }).file;
    if (!file) throw new AppError('NO_FILE', 'File tidak ada.', 400);
    if (!ALLOWED.includes(file.type)) {
      throw new AppError('BAD_TYPE', 'Tipe file tidak didukung.', 400);
    }
    if (file.size > MAX_BYTES) {
      throw new AppError('TOO_LARGE', 'Ukuran file melebihi 25 MB.', 400);
    }

    const storage = await getStorage();
    const buf = new Uint8Array(await file.arrayBuffer());
    const stamp = Date.now();
    const base = `assets/${stamp}-${safeName(file.name)}`;

    // Simpan original.
    const originalKey = await storage.put(base, buf, file.type);

    // Generate thumbnail (lebar maks 600px, webp) untuk preview storefront.
    let thumbKey: string | null = null;
    let width: number | null = null;
    let height: number | null = null;
    try {
      const img = sharp(buf);
      const meta = await img.metadata();
      width = meta.width ?? null;
      height = meta.height ?? null;
      const thumb = await img.resize({ width: 600, withoutEnlargement: true }).webp().toBuffer();
      thumbKey = await storage.put(`${base}.thumb.webp`, new Uint8Array(thumb), 'image/webp');
    } catch {
      // Bila bukan gambar yang bisa diproses sharp, lewati thumbnail.
    }

    // Catat media (original + thumbnail bila ada).
    await db.insert(media).values({
      key: originalKey,
      mimeType: file.type,
      sizeBytes: file.size,
      width,
      height,
    });

    const previewSource = thumbKey ?? originalKey;
    const previewUrl = await storage.getSignedUrl(previewSource, 3600);

    return { fileKey: originalKey, thumbKey, previewUrl };
  },
);
