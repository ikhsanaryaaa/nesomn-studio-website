import { scenePointerEvents } from '@/lib/scene-pointer-events';
import { useEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { useReducedMotionPreference } from '@/hooks/use-reduced-motion';
import { EffectComposer, Noise } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import { useScene3DEditor } from '@/stores/scene-3d-store';
import { useModel, disposeModel } from '@/components/viewer/use-model';
import { StudioEnvironment, FramedControls } from '@/components/viewer/studio-stage';
import { ModelMesh } from './model-mesh';
import { meshTargets } from '@/lib/mesh-target';
function Bridge({ onReady }: { onReady: (gl: THREE.WebGLRenderer | null) => void }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    onReady(gl);
    return () => onReady(null);
  }, [gl, onReady]);
  return null;
}
export function Scene3DViewport({
  onGlReady,
  autoRotate = false,
  onMeshes,
}: {
  onGlReady: (gl: THREE.WebGLRenderer | null) => void;
  autoRotate?: boolean;
  onMeshes?: (meshes: { path: string; name: string }[]) => void;
}) {
  const url = useScene3DEditor((s) => s.modelUrl),
    key = useScene3DEditor((s) => s.modelKey),
    source = useScene3DEditor((s) => s.modelSource),
    background = useScene3DEditor((s) => s.background),
    grain = useScene3DEditor((s) => s.grain),
    camera = useScene3DEditor((s) => s.camera);
  const loaded = useModel(url);
  const reduced = useReducedMotionPreference();
  const sample = useMemo(() => {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 2, 64),
      new THREE.MeshStandardMaterial({ color: '#d6d3cc', roughness: 0.45, metalness: 0.05 }),
    );
    mesh.name = 'Built-in cylinder sample';
    group.add(mesh);
    return group;
  }, []);
  useEffect(() => () => disposeModel(sample), [sample]);
  const object = key === 'mug' && source !== 'catalog' && !url ? sample : loaded.scene;
  useEffect(() => {
    onMeshes?.(object ? meshTargets(object).map(({ path, name }) => ({ path, name })) : []);
  }, [object, onMeshes]);
  if (!object)
    return (
      <div className="viewer-fallback" role={loaded.error ? 'alert' : 'status'}>
        {loaded.error ?? 'Loading model…'}
      </div>
    );
  return (
    <Canvas
      events={scenePointerEvents}
      shadows
      gl={{
        preserveDrawingBuffer: true,
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
      }}
      camera={{ fov: 45 }}
      dpr={[1, 1.5]}
      fallback={<p role="alert">WebGL is unavailable. Use a browser or device that supports 3D.</p>}
    >
      <color attach="background" args={[background]} />
      <StudioEnvironment />
      <ModelMesh object={object} />
      <FramedControls object={object} preset={camera} rotate={autoRotate} reduced={!!reduced} />
      <Bridge onReady={onGlReady} />
      {grain > 0 && (
        <EffectComposer>
          <Noise opacity={grain / 100} blendFunction={BlendFunction.OVERLAY} />
        </EffectComposer>
      )}
    </Canvas>
  );
}
