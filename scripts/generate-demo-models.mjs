// Original procedural meshes, embedded glTF2.0, deterministic byte output. No imported artwork.
import * as T from '../client/node_modules/three/build/three.module.js';
import { mkdirSync, writeFileSync } from 'node:fs';
const dir = 'client/public/demo/models';
mkdirSync(dir, { recursive: true });
const palette = [
  [0.92, 0.31, 0.08, 1],
  [0.72, 0.72, 0.66, 1],
  [0.15, 0.16, 0.14, 1],
  [0.95, 0.94, 0.89, 1],
];
function mesh(g, color = 0, pos = [0, 0, 0], rot = [0, 0, 0]) {
  const matrix = new T.Matrix4().compose(
    new T.Vector3(...pos),
    new T.Quaternion().setFromEuler(new T.Euler(...rot)),
    new T.Vector3(1, 1, 1),
  );
  g.applyMatrix4(matrix);
  return { g, color };
}
const box = (w, h, d, c = 0, p = [0, 0, 0], r = [0, 0, 0]) =>
  mesh(new T.BoxGeometry(w, h, d), c, p, r);
const models = [
  {
    id: 'nesomn-abstract-form',
    title: 'Abstract Form',
    meshes: [
      mesh(new T.TorusGeometry(1, 0.28, 12, 32), 0, [0, 0.1, 0], [0.5, 0.3, 0.2]),
      mesh(new T.IcosahedronGeometry(0.6, 0), 2, [0, 0, 0]),
      box(2.5, 0.12, 2.1, 1, [0, -1.2, 0]),
    ],
  },
  {
    id: 'nesomn-product-box',
    title: 'Product Box',
    meshes: [
      box(1.6, 2.1, 0.85, 3),
      box(1.61, 0.6, 0.86, 0, [0, 0.4, 0]),
      box(0.9, 0.12, 0.02, 2, [0, -0.5, 0.44]),
      box(0.5, 0.08, 0.02, 2, [0, -0.72, 0.44]),
    ],
  },
  {
    id: 'nesomn-lowpoly-room',
    title: 'Lowpoly Room',
    meshes: [
      box(5, 0.15, 4, 1, [0, -0.08, 0]),
      box(5, 2.8, 0.12, 3, [0, 1.4, -2]),
      box(0.12, 2.8, 4, 3, [-2.5, 1.4, 0]),
      box(1.7, 0.4, 0.75, 0, [-0.7, 0.6, -1.3]),
      box(1.7, 0.8, 0.18, 0, [-0.7, 1, -1.65]),
      box(0.9, 0.1, 0.7, 2, [0.8, 0.65, 0.3]),
      box(0.15, 0.6, 0.15, 2, [0.8, 0.3, 0.3]),
      box(0.8, 0.1, 0.8, 1, [0.8, 0.05, 0.3]),
      box(0.16, 1.6, 0.16, 2, [-1.7, 0.8, 0.8]),
      mesh(new T.ConeGeometry(0.4, 0.35, 8), 0, [-1.7, 1.7, 0.8]),
    ],
  },
  {
    id: 'nesomn-typography-block',
    title: 'Typography Block',
    meshes: [
      box(0.35, 2, 0.5, 0, [-0.8, 0, 0]),
      box(0.35, 2, 0.5, 0, [0.8, 0, 0]),
      box(0.35, 2.5, 0.5, 0, [0, 0, 0], [0, 0, -0.68]),
      box(2.5, 0.12, 1, 2, [0, -1.12, 0]),
    ],
  },
];
function glb(model) {
  const chunks = [],
    views = [],
    accessors = [],
    meshes = [];
  let offset = 0;
  function attr(array, type, componentType) {
    const padding = (4 - (offset % 4)) % 4;
    if (padding) {
      chunks.push(Buffer.alloc(padding));
      offset += padding;
    }
    const data = Buffer.from(array.buffer, array.byteOffset, array.byteLength),
      view = views.length;
    views.push({ buffer: 0, byteOffset: offset, byteLength: data.length });
    chunks.push(data);
    offset += data.length;
    const n = type === 'VEC3' ? 3 : type === 'VEC2' ? 2 : 1;
    const a = { bufferView: view, componentType, count: array.length / n, type };
    if (type === 'VEC3') {
      a.min = [Infinity, Infinity, Infinity];
      a.max = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < array.length; i++) {
        a.min[i % 3] = Math.min(a.min[i % 3], array[i]);
        a.max[i % 3] = Math.max(a.max[i % 3], array[i]);
      }
    }
    accessors.push(a);
    return accessors.length - 1;
  }
  for (const { g, color } of model.meshes) {
    meshes.push({
      name: model.title + ' ' + meshes.length,
      primitives: [
        {
          attributes: {
            POSITION: attr(g.attributes.position.array, 'VEC3', 5126),
            NORMAL: attr(g.attributes.normal.array, 'VEC3', 5126),
            TEXCOORD_0: attr(g.attributes.uv.array, 'VEC2', 5126),
          },
          ...(g.index
            ? {
                indices: attr(
                  g.index.array,
                  'SCALAR',
                  g.index.array instanceof Uint32Array ? 5125 : 5123,
                ),
              }
            : {}),
          material: color,
          mode: 4,
        },
      ],
    });
  }
  const doc = {
    asset: { version: '2.0', generator: 'Nesomn original procedural sample generator' },
    scene: 0,
    scenes: [{ nodes: meshes.map((_, i) => i) }],
    nodes: meshes.map((m, i) => ({ name: m.name, mesh: i })),
    meshes,
    materials: palette.map((color, i) => ({
      name: ['Orange', 'Stone', 'Ink', 'Paper'][i],
      pbrMetallicRoughness: { baseColorFactor: color, metallicFactor: 0.05, roughnessFactor: 0.65 },
    })),
    buffers: [{ byteLength: offset }],
    bufferViews: views,
    accessors,
  };
  let json = Buffer.from(JSON.stringify(doc));
  json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 32)]);
  let bin = Buffer.concat(chunks);
  bin = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4)]);
  const out = Buffer.alloc(28 + json.length + bin.length);
  out.writeUInt32LE(0x46546c67, 0);
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(out.length, 8);
  out.writeUInt32LE(json.length, 12);
  out.writeUInt32LE(0x4e4f534a, 16);
  json.copy(out, 20);
  out.writeUInt32LE(bin.length, 20 + json.length);
  out.writeUInt32LE(0x004e4942, 24 + json.length);
  bin.copy(out, 28 + json.length);
  return out;
}
// Orthographic SVG posters projected from the exact generated mesh triangles.
function poster(model) {
  const tris = [];
  const camera = new T.Matrix4()
    .makeRotationY(-0.55)
    .premultiply(new T.Matrix4().makeRotationX(0.35));
  let max = 0;
  for (const { g, color } of model.meshes) {
    const geom = g.index ? g.toNonIndexed() : g;
    const p = geom.attributes.position;
    for (let i = 0; i < p.count; i += 3) {
      const points = [0, 1, 2].map((n) =>
        new T.Vector3().fromBufferAttribute(p, i + n).applyMatrix4(camera),
      );
      max = Math.max(max, ...points.flatMap((p) => [Math.abs(p.x), Math.abs(p.y)]));
      tris.push({ points, z: points.reduce((s, p) => s + p.z, 0) / 3, color });
    }
    if (geom !== g) geom.dispose();
  }
  const scale = 130 / Math.max(max, 0.1);
  const polys = tris
    .sort((a, b) => a.z - b.z)
    .map(
      ({ points, color }) =>
        '<polygon points="' +
        points.map((p) => `${200 + p.x * scale},${175 - p.y * scale}`).join(' ') +
        '" fill="rgb(' +
        palette[color]
          .slice(0, 3)
          .map((c) => Math.round(c * 255))
          .join(',') +
        ')" stroke="#222" stroke-opacity=".12"/>',
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect width="400" height="400" fill="#eeede8"/>${polys}<text x="20" y="365" font-family="sans-serif" font-size="15" fill="#20201d">${model.title} · Demo / Sample</text></svg>`;
}
const manifest = models.map((m) => {
  const data = glb(m);
  writeFileSync(dir + '/' + m.id + '.glb', data);
  writeFileSync(dir + '/' + m.id + '.svg', poster(m));
  return {
    id: m.id,
    title: m.title,
    url: '/demo/models/' + m.id + '.glb',
    poster: '/demo/models/' + m.id + '.svg',
    bytes: data.length,
    label: 'Demo / Sample',
    license: 'Original Nesomn procedural demonstration; not a marketplace product',
  };
});
writeFileSync(dir + '/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log('Generated4 original GLBs + projected posters + manifest');
