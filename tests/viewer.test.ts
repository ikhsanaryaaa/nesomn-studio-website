import { expect, test } from 'bun:test';
import {
  frameBounds,
  validateModelUrl,
  inspectModelBytes,
  registerCatalogModelUrl,
} from '../client/src/lib/model-3d.ts';
import * as THREE from '../client/node_modules/three';
import { meshTargets, targetMesh } from '../client/src/lib/mesh-target.ts';
import { GLTFLoader } from '../client/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { readFileSync } from 'node:fs';
test('frame handles wide/tall bounds, aspect and near/far without clipping', () => {
  const wide = frameBounds([20, 2, 1], 1, 45),
    mobile = frameBounds([20, 2, 1], 0.4, 45);
  expect(mobile.distance).toBeGreaterThan(wide.distance);
  expect(wide.near).toBeGreaterThan(0);
  expect(wide.far).toBeGreaterThan(wide.distance + 20);
  expect(frameBounds([0, 0, 0], 1, 45).distance).toBeGreaterThan(0);
});
test('mesh targeting uses stable paths and ignores projected decal children', () => {
  const root = new THREE.Group(),
    small = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)),
    large = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4));
  root.add(small, large);
  const overlay = new THREE.Mesh(new THREE.BoxGeometry(20, 20, 20));
  overlay.userData.nesomnDecal = true;
  large.add(overlay);
  expect(meshTargets(root)).toHaveLength(2);
  expect(targetMesh(root)).toBe(large);
  expect(targetMesh(root, '0.0')).toBe(small);
  expect(targetMesh(root, 'missing')).toBeUndefined();
  for (const mesh of [small, large, overlay]) {
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  }
});
test('independent GLTF loads do not share mutable materials; embedded glTF loads too', async () => {
  const prior = Object.getOwnPropertyDescriptor(globalThis, 'ProgressEvent');
  if (!prior)
    Object.defineProperty(globalThis, 'ProgressEvent', {
      value: class extends Event {
        constructor(type: string) {
          super(type);
        }
      },
      configurable: true,
    });
  const bytes = readFileSync('client/public/demo/models/nesomn-product-box.glb'),
    buffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
  const [a, b] = await Promise.all([
    new GLTFLoader().parseAsync(buffer, ''),
    new GLTFLoader().parseAsync(buffer, ''),
  ]);
  const ma = targetMesh(a.scene)!,
    mb = targetMesh(b.scene)!;
  expect(ma.material).not.toBe(mb.material);
  expect(ma.geometry).not.toBe(mb.geometry);
  const color = (mb.material as THREE.MeshStandardMaterial).color.clone();
  (ma.material as THREE.MeshStandardMaterial).color.set('#123456');
  expect((mb.material as THREE.MeshStandardMaterial).color.equals(color)).toBe(true);
  const doc = inspectModelBytes(buffer);
  const view = new DataView(buffer),
    offset = 20 + view.getUint32(12, true);
  const bin = bytes.subarray(offset + 8);
  (doc.buffers as { uri?: string }[])[0].uri =
    'data:application/octet-stream;base64,' + bin.toString('base64');
  const text = JSON.stringify(doc);
  expect(() => inspectModelBytes(new TextEncoder().encode(text).buffer)).not.toThrow();
  const gltf = await new GLTFLoader().parseAsync(text, '');
  expect(meshTargets(gltf.scene)).toHaveLength(4);
  if (!prior) Reflect.deleteProperty(globalThis, 'ProgressEvent');
  for (const root of [a.scene, b.scene, gltf.scene])
    root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        for (const m of Array.isArray(obj.material) ? obj.material : [obj.material]) m.dispose();
      }
    });
});
test('model sources reject unsafe URL and bad/oversize/externally-dependent files', () => {
  expect(() => validateModelUrl('javascript:alert(1)', 'https://studio.test')).toThrow();
  expect(() =>
    validateModelUrl('https://x.test/model.glb?token=secret', 'https://studio.test'),
  ).toThrow();
  registerCatalogModelUrl('https://storage.test/registered.glb?signature=sample');
  expect(() =>
    validateModelUrl('https://storage.test/registered.glb?signature=sample', 'https://studio.test'),
  ).not.toThrow();
  expect(() =>
    validateModelUrl('/demo/models/nesomn-product-box.glb', 'https://studio.test'),
  ).not.toThrow();
  expect(() => validateModelUrl('/uploads/unregistered.glb', 'https://studio.test')).toThrow();
  expect(() => inspectModelBytes(new Uint8Array([1, 2, 3]).buffer)).toThrow();
  expect(() =>
    inspectModelBytes(
      new TextEncoder().encode(
        JSON.stringify({ asset: { version: '2.0' }, buffers: [{ uri: 'https://evil.test/x' }] }),
      ).buffer,
    ),
  ).toThrow();
});

test('Studio Kit has an embedded texture and valid bounded GLB', () => {
  const bytes = readFileSync('client/public/demo/models/nesomn-studio-kit.glb');
  const doc = inspectModelBytes(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
  );
  expect(doc.images).toHaveLength(1);
  expect(JSON.stringify(doc)).not.toContain('https://');
  expect(() =>
    validateModelUrl('/demo/models/nesomn-studio-kit.glb', 'https://studio.test'),
  ).not.toThrow();
});
