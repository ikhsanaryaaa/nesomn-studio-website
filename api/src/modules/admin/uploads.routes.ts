import { Elysia } from 'elysia';
import { validateUpload } from '../../lib/upload-validation.ts';
import { authPlugin, type AuthUser } from '../../middleware/auth.ts';
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

/** Bersihkan nama file jadi key aman. */
function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
}

export const uploadAdminRoutes = new Elysia({ prefix: '/uploads' })
  .use(authPlugin)
  .post('/', async ({ body, query, user }) => {
    // kind=preview (default) untuk gambar preview; kind=file untuk file produk.
    const kind = (query as Record<string, string | undefined>).kind ?? 'preview';
    if (kind !== 'file' && kind !== 'preview')
      throw new AppError('BAD_REQUEST', 'Invalid upload kind.', 400);
    const isFile = kind === 'file';

    const file = (body as { file?: File }).file;
    if (!file) throw new AppError('NO_FILE', 'File is missing.', 400);

    const maxBytes = isFile ? MAX_FILE_BYTES : MAX_PREVIEW_BYTES;
    if (file.size > maxBytes) {
      const mb = Math.round(maxBytes / (1024 * 1024));
      throw new AppError('TOO_LARGE', `File size exceeds ${mb} MB.`, 400);
    }

    const storage = await getStorage();
    const buf = new Uint8Array(await file.arrayBuffer());
    let checked: Awaited<ReturnType<typeof validateUpload>>;
    try {
      checked = await validateUpload(buf, file.name, file.type, isFile ? 'file' : 'preview');
    } catch {
      throw new AppError(
        'BAD_TYPE',
        'The file contents or format are invalid or unsupported.',
        400,
      );
    }
    const base = `assets/${crypto.randomUUID()}-${safeName(file.name)}`;
    let originalKey: string | undefined,
      thumbKey: string | null = null;
    try {
      originalKey = await storage.put(base, buf, checked.mime);
      if (checked.thumb)
        thumbKey = await storage.put(
          base + '.thumb.webp',
          new Uint8Array(checked.thumb),
          'image/webp',
        );
      // Catat media (original + thumbnail bila ada).
      return await db.transaction(async (tx) => {
        const [original] = await tx
          .insert(media)
          .values({
            key: originalKey!,
            mimeType: checked.mime,
            ownerId: (user as AuthUser).id,
            sizeBytes: file.size,
            width: checked.width,
            height: checked.height,
          })
          .returning({ id: media.id });

        let previewId = original!.id;
        if (thumbKey) {
          const [thumbnail] = await tx
            .insert(media)
            .values({
              ownerId: (user as AuthUser).id,
              key: thumbKey,
              mimeType: 'image/webp',
              sizeBytes: checked.thumb!.length,
              width: Math.min(checked.width!, 600),
            })
            .returning({ id: media.id });
          previewId = thumbnail!.id;
        }
        const previewSource = thumbKey ?? originalKey!;
        const previewUrl = await storage.getSignedUrl(previewSource, 3600);

        return {
          fileKey: originalKey!,
          thumbKey,
          previewUrl,
          previewPath: isFile ? null : '/api/catalog/preview/' + previewId,
        };
      });
    } catch (error) {
      if (originalKey) await storage.delete(originalKey);
      if (thumbKey) await storage.delete(thumbKey);
      throw error;
    }
  });
