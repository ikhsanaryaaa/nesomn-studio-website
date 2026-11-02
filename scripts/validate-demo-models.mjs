import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const folder = 'client/public/demo/models',
  manifest = JSON.parse(readFileSync(folder + '/manifest.json'));
for (const m of manifest) {
  const data = readFileSync(folder + '/' + m.id + '.glb');
  assert.equal(data.readUInt32LE(0), 0x46546c67);
  assert.equal(data.readUInt32LE(4), 2);
  assert.equal(data.readUInt32LE(8), data.length);
  let offset = 12,
    json,
    bin;
  while (offset < data.length) {
    const size = data.readUInt32LE(offset),
      type = data.readUInt32LE(offset + 4);
    assert.equal(size % 4, 0);
    assert.ok(offset + 8 + size <= data.length);
    if (type === 0x4e4f534a) {
      assert.equal(offset, 12);
      json = JSON.parse(data.subarray(offset + 8, offset + 8 + size));
    } else if (type === 0x004e4942) {
      assert.ok(!bin);
      bin = data.subarray(offset + 8, offset + 8 + size);
    } else assert.fail('Unknown GLB chunk');
    offset += 8 + size;
  }
  assert.equal(offset, data.length);
  assert.equal(json.asset.version, '2.0');
  assert.ok(json.meshes.length && json.materials.length && bin);
  assert.equal(json.buffers.length, 1);
  assert.ok(json.buffers[0].byteLength <= bin.length);
  assert.ok(bin.length - json.buffers[0].byteLength < 4);
  const components = { 5126: 4, 5125: 4, 5123: 2, 5121: 1 },
    counts = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  for (const a of json.accessors) {
    const v = json.bufferViews[a.bufferView],
      bytes = components[a.componentType] * counts[a.type],
      start = a.byteOffset ?? 0,
      stride = v.byteStride ?? bytes;
    assert.equal(v.buffer, 0);
    assert.ok((v.byteOffset ?? 0) + v.byteLength <= json.buffers[0].byteLength);
    assert.ok(start + (a.count - 1) * stride + bytes <= v.byteLength);
    assert.ok(a.count > 0 && bytes);
    if (a.type === 'VEC3') {
      assert.equal(a.min.length, 3);
      assert.equal(a.max.length, 3);
      for (let i = 0; i < a.count; i++)
        for (let j = 0; j < 3; j++) {
          const n = bin.readFloatLE((v.byteOffset ?? 0) + start + i * stride + j * 4);
          assert.ok(Number.isFinite(n) && n >= a.min[j] - 1e-6 && n <= a.max[j] + 1e-6);
        }
    }
  }
  for (const mesh of json.meshes)
    for (const p of mesh.primitives) {
      assert.ok(json.materials[p.material]);
      assert.ok(json.accessors[p.attributes.POSITION]);
      if (p.indices !== undefined) {
        const a = json.accessors[p.indices],
          v = json.bufferViews[a.bufferView];
        for (let i = 0; i < a.count; i++) {
          const pos = (v.byteOffset ?? 0) + (a.byteOffset ?? 0) + i * components[a.componentType];
          const n = a.componentType === 5123 ? bin.readUInt16LE(pos) : bin.readUInt32LE(pos);
          assert.ok(n < json.accessors[p.attributes.POSITION].count);
        }
      }
    }
  assert.ok(!json.images?.some((i) => i.uri));
  assert.equal(data.length, m.bytes);
  assert.ok(readFileSync('client/public' + m.poster).includes('<svg'));
  console.log('PASS', m.id, data.length, 'bytes', json.meshes.length, 'meshes');
}
