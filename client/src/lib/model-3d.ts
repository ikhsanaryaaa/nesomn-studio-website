export const MAX_MODEL_BYTES = 25 * 1024 * 1024;
export function frameBounds(size: number[], aspect: number, fov: number) {
  const radius = Math.max(Math.hypot(...size) / 2, 0.01);
  const half = Math.min(
    (fov * Math.PI) / 360,
    Math.atan(Math.tan((fov * Math.PI) / 360) * Math.max(aspect, 0.1)),
  );
  const distance = (radius / Math.sin(half)) * 1.18;
  return {
    radius,
    distance,
    near: Math.max(radius / 1000, 0.00001),
    far: distance + radius * 12,
    minDistance: radius * 1.15,
    maxDistance: distance * 5,
  };
}
export function validateModelUrl(value: string, origin: string) {
  const url = new URL(value, origin);
  if (
    url.username ||
    url.password ||
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.origin === origin))
  )
    throw Error('URL model tidak didukung. Gunakan storage HTTPS atau sumber lokal aplikasi.');
  return url.href;
}
export function inspectModelBytes(bytes: ArrayBuffer) {
  if (bytes.byteLength > MAX_MODEL_BYTES || bytes.byteLength < 12)
    throw Error('Model tidak valid atau melebihi 25MB.');
  const v = new DataView(bytes);
  let json: Record<string, unknown>;
  if (v.getUint32(0, true) === 0x46546c67) {
    if (bytes.byteLength < 20) throw Error('Chunk GLB terpotong.');
    if (v.getUint32(4, true) !== 2 || v.getUint32(8, true) !== bytes.byteLength)
      throw Error('Header GLB tidak valid.');
    const length = v.getUint32(12, true);
    if (v.getUint32(16, true) !== 0x4e4f534a || 20 + length > bytes.byteLength)
      throw Error('Chunk GLB tidak valid.');
    json = JSON.parse(new TextDecoder().decode(bytes.slice(20, 20 + length)));
  } else {
    try {
      json = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    } catch {
      throw Error('File harus GLB atau GLTF 2.0.');
    }
  }
  if ((json.asset as { version?: string })?.version !== '2.0') throw Error('Versi glTF harus 2.0.');
  const buffers = (json.buffers ?? []) as { byteLength: number; uri?: string }[],
    views = (json.bufferViews ?? []) as {
      buffer: number;
      byteOffset?: number;
      byteLength: number;
      byteStride?: number;
    }[];
  const integer = (v: number) => Number.isSafeInteger(v) && v >= 0;
  for (const buffer of buffers)
    if (!integer(buffer.byteLength) || buffer.byteLength > MAX_MODEL_BYTES)
      throw Error('Buffer model tidak valid.');
  for (const view of views) {
    const buffer = buffers[view.buffer];
    if (
      !buffer ||
      !integer(view.byteOffset ?? 0) ||
      !integer(view.byteLength) ||
      (view.byteOffset ?? 0) + view.byteLength > buffer.byteLength
    )
      throw Error('Buffer view keluar batas.');
  }
  const components: Record<number, number> = {
      5120: 1,
      5121: 1,
      5122: 2,
      5123: 2,
      5125: 4,
      5126: 4,
    },
    widths: Record<string, number> = {
      SCALAR: 1,
      VEC2: 2,
      VEC3: 3,
      VEC4: 4,
      MAT2: 4,
      MAT3: 9,
      MAT4: 16,
    };
  let values = 0;
  for (const accessor of (json.accessors ?? []) as {
    count: number;
    componentType: number;
    type: string;
    bufferView?: number;
    byteOffset?: number;
  }[]) {
    values += accessor.count;
    const bytes = components[accessor.componentType] * widths[accessor.type];
    if (
      !integer(accessor.count) ||
      accessor.count > 2000000 ||
      !bytes ||
      !integer(accessor.byteOffset ?? 0) ||
      values > 10000000
    )
      throw Error('Accessor melebihi batas model.');
    if (accessor.bufferView !== undefined) {
      const view = views[accessor.bufferView],
        stride = view?.byteStride ?? bytes;
      if (
        !view ||
        stride < bytes ||
        !integer(stride) ||
        (accessor.byteOffset ?? 0) + Math.max(0, accessor.count - 1) * stride + bytes >
          view.byteLength
      )
        throw Error('Accessor keluar batas buffer.');
    }
  }
  // Embedded resources avoid additional unbounded requests, CORS leaks and orphaned loads.
  for (const item of [
    ...((json.buffers ?? []) as { uri?: string }[]),
    ...((json.images ?? []) as { uri?: string }[]),
  ])
    if (
      item.uri &&
      !/^data:(application\/octet-stream|application\/gltf-buffer|image\/(png|jpeg|webp));base64,/.test(
        item.uri,
      )
    )
      throw Error(
        'GLTF membutuhkan resource tertanam; ekspor sebagai GLB atau embed buffer/texture.',
      );
  if (
    json.extensionsRequired &&
    (json.extensionsRequired as string[]).some((e) =>
      ['KHR_draco_mesh_compression', 'EXT_meshopt_compression', 'KHR_texture_basisu'].includes(e),
    )
  )
    throw Error(
      'Model compressed membutuhkan decoder yang belum didukung. Ekspor GLB tanpa compression.',
    );
  return json;
}
