import { readFileSync, writeFileSync } from 'node:fs';
const base = readFileSync('client/public/demo/models/nesomn-product-box.glb'),
  j = JSON.parse(base.subarray(20, 20 + base.readUInt32LE(12)).toString());
const at = 20 + base.readUInt32LE(12),
  old = base.subarray(at + 8),
  png = readFileSync('client/public/demo/portfolio/studio-kit/box-artwork.png');
// glTF texture coordinates start at the top; the original untextured box used bottom-up UVs.
const uv = j.accessors[j.meshes[0].primitives[0].attributes.TEXCOORD_0],
  uvView = j.bufferViews[uv.bufferView];
for (let i = 0; i < uv.count; i++) {
  const offset = (uvView.byteOffset || 0) + (uv.byteOffset || 0) + i * (uvView.byteStride || 8) + 4;
  old.writeFloatLE(1 - old.readFloatLE(offset), offset);
}
const pad = (b) => Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4)]);
const bin = pad(Buffer.concat([old, png]));
j.images = [{ bufferView: j.bufferViews.length, mimeType: 'image/png' }];
j.bufferViews.push({ buffer: 0, byteOffset: old.length, byteLength: png.length });
j.buffers[0].byteLength = bin.length;
j.textures = [{ source: 0 }];
j.materials[3].pbrMetallicRoughness = {
  baseColorFactor: [1, 1, 1, 1],
  baseColorTexture: { index: 0 },
  metallicFactor: 0,
  roughnessFactor: 0.78,
};
j.meshes = j.meshes.slice(0, 1);
j.meshes[0].name = 'Nesomn Studio Kit';
j.nodes = [{ mesh: 0, name: 'Nesomn Studio Kit' }];
j.scenes = [{ nodes: [0] }];
j.scene = 0;
const text = Buffer.from(JSON.stringify(j)),
  json = Buffer.concat([text, Buffer.alloc((4 - (text.length % 4)) % 4, 32)]),
  out = Buffer.alloc(12 + 8 + json.length + 8 + bin.length);
out.writeUInt32LE(0x46546c67, 0);
out.writeUInt32LE(2, 4);
out.writeUInt32LE(out.length, 8);
out.writeUInt32LE(json.length, 12);
out.writeUInt32LE(0x4e4f534a, 16);
json.copy(out, 20);
out.writeUInt32LE(bin.length, 20 + json.length);
out.writeUInt32LE(0x004e4942, 24 + json.length);
bin.copy(out, 28 + json.length);
writeFileSync('client/public/demo/models/nesomn-studio-kit.glb', out);
writeFileSync(
  'client/public/demo/models/studio-kit.json',
  JSON.stringify(
    {
      id: 'nesomn-studio-kit',
      title: 'Nesomn Studio Kit',
      url: '/demo/models/nesomn-studio-kit.glb',
      poster: '/demo/portfolio/studio-kit/packaging.png',
      bytes: out.length,
      label: 'Demo / Sample',
      license: 'Original Nesomn internal concept; not a client commission or marketplace product',
    },
    null,
    2,
  ),
);
