import { useEffect, useState } from 'react';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { MAX_MODEL_BYTES, inspectModelBytes, validateModelUrl } from '@/lib/model-3d';
export function disposeModel(root: THREE.Object3D) {
  const geometry = new Set<THREE.BufferGeometry>(),
    materials = new Set<THREE.Material>(),
    textures = new Set<THREE.Texture>();
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      geometry.add(obj.geometry);
      for (const material of Array.isArray(obj.material) ? obj.material : [obj.material]) {
        materials.add(material);
        for (const value of Object.values(material))
          if (value instanceof THREE.Texture) textures.add(value);
      }
    }
  });
  for (const t of textures) {
    const source = t.source?.data;
    if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) source.close();
    t.dispose();
  }
  for (const m of materials) m.dispose();
  for (const g of geometry) g.dispose();
}
export function useModel(url: string | null, retry = 0) {
  const [state, setState] = useState<{
    source?: string | null;
    scene: THREE.Group | null;
    progress: number;
    error: string | null;
  }>({ scene: null, progress: 0, error: null });
  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 25000);
    let active = true,
      owned: THREE.Group | null = null;
    setState({ source: url, scene: null, progress: 0, error: null });
    if (url)
      void (async () => {
        try {
          const safe = validateModelUrl(url, window.location.origin),
            response = await fetch(safe, {
              signal: controller.signal,
              credentials: new URL(safe).origin === window.location.origin ? 'include' : 'omit',
              redirect: 'error',
            });
          if (!response.ok)
            throw Error(
              'Unable to load the model. Check storage access and CORS settings, then try again.',
            );
          const length = Number(response.headers.get('content-length'));
          if (length > MAX_MODEL_BYTES) throw Error('The model exceeds 25 MB.');
          const reader = response.body?.getReader();
          if (!reader) throw Error('The model stream is unavailable.');
          const chunks: Uint8Array[] = [];
          let size = 0;
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              size += value.byteLength;
              if (size > MAX_MODEL_BYTES) throw Error('The model exceeds 25 MB.');
              chunks.push(value);
              if (active)
                setState({
                  source: url,
                  scene: null,
                  error: null,
                  progress: length ? Math.min(99, Math.round((size / length) * 100)) : 0,
                });
            }
          } finally {
            await reader.cancel().catch(() => {});
            reader.releaseLock();
          }
          const data = new Uint8Array(size);
          let offset = 0;
          for (const chunk of chunks) {
            data.set(chunk, offset);
            offset += chunk.length;
          }
          inspectModelBytes(data.buffer);
          const gltf = await new GLTFLoader().parseAsync(data.buffer, '');
          owned = gltf.scene;
          let vertices = 0,
            meshes = 0;
          owned.traverse((obj) => {
            if (obj instanceof THREE.Mesh) {
              obj.castShadow = true;
              obj.receiveShadow = true;
              meshes++;
              vertices += obj.geometry.attributes.position?.count ?? 0;
            }
          });
          if (!meshes || vertices > 2000000) {
            disposeModel(owned);
            owned = null;
            throw Error('The model is empty or exceeds the two-million-vertex limit.');
          }
          if (!active) {
            disposeModel(owned);
            owned = null;
            return;
          }
          owned.updateMatrixWorld(true);
          setState({ source: url, scene: owned, progress: 100, error: null });
        } catch (error) {
          if (active)
            setState({
              source: url,
              scene: null,
              progress: 0,
              error:
                error instanceof Error && error.name === 'AbortError'
                  ? 'Loading canceled.'
                  : error instanceof Error
                    ? error.message
                    : 'Invalid model.',
            });
        } finally {
          clearTimeout(timeout);
        }
      })();
    return () => {
      clearTimeout(timeout);
      active = false;
      controller.abort();
      if (owned) disposeModel(owned);
    };
  }, [url, retry]);
  return state.source === url ? state : { scene: null, progress: 0, error: null };
}
