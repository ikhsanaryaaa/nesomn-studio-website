import { lookup } from 'node:dns/promises';
import { assertProviderUrl, publicAddress } from './outbound.ts';
import { validateUpload } from './upload-validation.ts';
/** Only raster data or explicitly allowed public storage may be forwarded to vendors. */
export async function validateAiMedia(input: Record<string, unknown>) {
  const values = [
    input.baseImage,
    input.startFrame,
    input.endFrame,
    ...(Array.isArray(input.referenceImages) ? input.referenceImages : []),
  ].filter((value) => value !== undefined);
  let size = 0;
  for (const value of values) {
    if (typeof value !== 'string' || value.length > 12 * 1024 * 1024)
      throw new Error('Invalid AI image input');
    size += value.length;
    if (size > 25 * 1024 * 1024) throw new Error('AI input images too large');
    const data = value.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
    if (data) {
      await validateUpload(
        Buffer.from(data[2]!, 'base64'),
        'input.' + (data[1] === 'jpeg' ? 'jpg' : data[1]),
        '',
        'preview',
      );
      continue;
    }
    const url = assertProviderUrl(
      value,
      (process.env.AI_INPUT_HOSTS ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      true,
    );
    const rows = await lookup(url.hostname, { all: true });
    if (!rows.length || rows.some((row) => !publicAddress(row.address)))
      throw new Error('AI input storage must resolve to public addresses');
  }
}
