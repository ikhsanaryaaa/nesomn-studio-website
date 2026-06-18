import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl as presign } from '@aws-sdk/s3-request-presigner';
import type { StorageDriver } from './index.ts';

/**
 * Driver R2/S3 untuk produksi. Memakai env R2_*.
 * Di-import lazy oleh index.ts agar dev (driver local) tidak butuh paket ini.
 */
export function createR2Driver(): StorageDriver {
  const bucket = process.env.R2_BUCKET;
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error('Konfigurasi R2 belum lengkap (R2_* env).');
  }

  const client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });

  return {
    async put(key, bytes, contentType) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: bytes,
          ContentType: contentType,
        }),
      );
      return key;
    },
    async getSignedUrl(key, ttlSeconds = 300) {
      return presign(client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
        expiresIn: ttlSeconds,
      });
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}
