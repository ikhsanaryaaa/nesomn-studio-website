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

// Limit ukuran dibedakan: preview (gambar storefront) vs file produk.
const MAX_PREVIEW_BYTES = 25 * 1024 * 1024; // 25 MB
const MAX_FILE_BYTES = 100 * 1024 * 1024; // 100 MB (mis. .glb / .zip)

// Format gambar (untuk preview & mockup 2D yang bisa dibuat thumbnail).
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'];
// Format file produk yang dijual (non-gambar) yang juga diizinkan.
const FILE_TYPES = [
  ...IMAGE_TYPES,
  'model/gltf-binary', // .glb
  'model/gltf+json', // .gltf
  'application/octet-stream', // .glb sering terkirim sebagai ini
  'font/otf',
  'font/ttf',
  'application/zip',
  'application/x-zip-compressed',
  'video/mp4',
  'video/webm',
];

/** Bersihkan nama file jadi key aman. */
function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
}

export const uploadAdminRoutes = new Elysia({ prefix: '/uploads' }).post(
  '/',
  async ({ body, query }) => {
    // kind=preview (default) untuk gambar preview; kind=file untuk file produk.
    const kind = (query as Record<string, string | undefined>).kind ?? 'preview';
    const isFile = kind === 'file';

    const file = (body as { file?: File }).file;
    if (!file) throw new AppError('NO_FILE', 'File tidak ada.', 400);

    const allowed = isFile ? FILE_TYPES : IMAGE_TYPES;
    if (!allowed.includes(file.type)) {
      throw new AppError('BAD_TYPE', `Tipe file tidak didukung: ${file.type || 'unknown'}.`, 400);
    }

    const maxBytes = isFile ? MAX_FILE_BYTES : MAX_PREVIEW_BYTES;
    if (file.size > maxBytes) {
      const mb = Math.round(maxBytes / (1024 * 1024));
      throw new AppError('TOO_LARGE', `Ukuran file melebihi ${mb} MB.`, 400);
    }

    const storage = await getStorage();
    const buf = new Uint8Array(await file.arrayBuffer());
    const stamp = Date.now();
    const base = `assets/${stamp}-${safeName(file.name)}`;

    // Simpan original.
    const originalKey = await storage.put(base, buf, file.type);

    // Generate thumbnail hanya untuk gambar raster (bukan .glb/.zip/svg).
    let thumbKey: string | null = null;
    let width: number | null = null;
    let height: number | null = null;
    const canThumbnail = file.type.startsWith('image/') && file.type !== 'image/svg+xml';
    if (canThumbnail) {
      try {
        const img = sharp(buf);
        const meta = await img.metadata();
        width = meta.width ?? null;
        height = meta.height ?? null;
        const thumb = await img.resize({ width: 600, withoutEnlargement: true }).webp().toBuffer();
        thumbKey = await storage.put(`${base}.thumb.webp`, new Uint8Array(thumb), 'image/webp');
      } catch {
        // Bila gambar tidak bisa diproses sharp, lewati thumbnail.
      }
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
