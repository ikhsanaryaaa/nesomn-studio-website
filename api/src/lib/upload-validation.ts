import sharp from 'sharp';
/** Byte validation is an upload boundary, not a full glTF renderer validation (phase 8). */
export async function validateUpload(
  bytes: Uint8Array,
  name: string,
  _claimed: string,
  kind: 'file' | 'preview',
) {
  if (!bytes.length) throw new Error('The file is empty.');
  const ext = name.split('.').pop()?.toLowerCase();
  const b = Buffer.from(bytes);
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext ?? '')) {
    const img = sharp(b, { limitInputPixels: 40_000_000, failOn: 'warning' });
    const meta = await img.metadata();
    const mime = (
      { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' } as Record<
        string,
        string
      >
    )[meta.format ?? ''];
    if (!mime || !meta.width || !meta.height || meta.width * meta.height > 40_000_000)
      throw new Error('Invalid image.');
    const thumb = await img.resize({ width: 600, withoutEnlargement: true }).webp().toBuffer();
    return { mime, width: meta.width, height: meta.height, thumb };
  }
  if (kind !== 'file') throw new Error('Previews must be valid raster images.');
  if (ext === 'glb') {
    if (
      b.length < 20 ||
      b.readUInt32LE(0) !== 0x46546c67 ||
      b.readUInt32LE(4) !== 2 ||
      b.readUInt32LE(8) !== b.length
    )
      throw new Error('Invalid GLB header');
    let offset = 12,
      json: unknown;
    while (offset < b.length) {
      if (offset + 8 > b.length) throw new Error('Invalid GLB chunk');
      const len = b.readUInt32LE(offset),
        type = b.readUInt32LE(offset + 4);
      if (len % 4 || offset + 8 + len > b.length) throw new Error('Invalid GLB chunk bounds');
      if (offset === 12) {
        if (type !== 0x4e4f534a) throw new Error('Missing JSON chunk');
        json = JSON.parse(b.subarray(offset + 8, offset + 8 + len).toString('utf8'));
      }
      offset += 8 + len;
    }
    validateGltf(json);
    return { mime: 'model/gltf-binary' };
  }
  if (ext === 'gltf') {
    validateGltf(JSON.parse(b.toString('utf8')));
    return { mime: 'model/gltf+json' };
  }
  if (ext === 'zip' && b.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 3, 4])))
    return { mime: 'application/zip' };
  if (ext === 'otf' && b.subarray(0, 4).toString() === 'OTTO') return { mime: 'font/otf' };
  if (ext === 'ttf' && b.length > 12 && b.readUInt32BE(0) === 0x00010000)
    return { mime: 'font/ttf' };
  if (ext === 'mp4' && b.length > 12 && b.subarray(4, 8).toString() === 'ftyp')
    return { mime: 'video/mp4' };
  if (ext === 'webm' && b.length > 12 && b.readUInt32BE(0) === 0x1a45dfa3)
    return { mime: 'video/webm' };
  throw new Error(
    'The file format or contents are unsupported. Active SVG content is not accepted.',
  );
}
function validateGltf(value: unknown) {
  const json = value as {
    asset?: { version?: string };
    buffers?: { uri?: string }[];
    images?: { uri?: string }[];
  };
  if (json?.asset?.version !== '2.0') throw new Error('glTF 2.0 required');
  for (const resource of [...(json.buffers ?? []), ...(json.images ?? [])])
    if (
      resource.uri &&
      !/^data:(?:application\/(?:octet-stream|gltf-buffer)|image\/(?:png|jpeg|webp));base64,[A-Za-z0-9+/=]+$/.test(
        resource.uri,
      )
    )
      throw new Error('glTF must contain its resources; external URLs/paths refused.');
}
