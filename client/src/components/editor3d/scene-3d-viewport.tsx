import { Suspense, useEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Center } from '@react-three/drei';
import { EffectComposer, Noise } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import type { CameraPreset } from '@nesomn/shared';
import * as THREE from 'three';
import { ModelMesh } from './model-mesh';
import { useScene3DEditor } from '@/stores/scene-3d-store';

/**
 * Viewport R3F: model + lighting + OrbitControls + grain (Noise).
 * Render client-side. preserveDrawingBuffer aktif agar capture
 * image/video (export) membaca buffer dengan benar.
 */

/** Posisi kamera untuk tiap preset sudut. */
const CAMERA_POSITIONS: Record<CameraPreset, [number, number, number]> = {
  front: [0, 0, 4.5],
  threeQuarter: [3.2, 2.2, 3.2],
  side: [4.5, 0, 0],
  top: [0, 4.5, 0.001],
};

/** Pindahkan kamera saat preset berubah (animasi sederhana via lerp). */
function CameraRig({ preset }: { preset: CameraPreset }) {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3(...CAMERA_POSITIONS[preset]));

  useEffect(() => {
    target.current.set(...CAMERA_POSITIONS[preset]);
  }, [preset]);

  useEffect(() => {
    let raf = 0;
    const animate = () => {
      camera.position.lerp(target.current, 0.15);
      camera.lookAt(0, 0, 0);
      if (camera.position.distanceTo(target.current) > 0.01) {
        raf = requestAnimationFrame(animate);
      }
    };
    animate();
    return () => cancelAnimationFrame(raf);
  }, [camera, preset]);

  return null;
}

/** Sinkronkan ref renderer/canvas ke parent untuk export. */
function GlBridge({ onReady }: { onReady: (gl: THREE.WebGLRenderer) => void }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    onReady(gl);
  }, [gl, onReady]);
  return null;
}

type Scene3DViewportProps = {
  onGlReady: (gl: THREE.WebGLRenderer) => void;
  autoRotate?: boolean;
};

export function Scene3DViewport({ onGlReady, autoRotate = false }: Scene3DViewportProps) {
  const background = useScene3DEditor((s) => s.background);
  const grain = useScene3DEditor((s) => s.grain);
  const camera = useScene3DEditor((s) => s.camera);

  return (
    <Canvas
      shadows
      gl={{ preserveDrawingBuffer: true, antialias: true }}
      camera={{ position: CAMERA_POSITIONS[camera], fov: 45 }}
      dpr={[1, 2]}
    >
      <color attach="background" args={[background]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 5]} intensity={1.1} castShadow />
      <directionalLight position={[-5, 3, -5]} intensity={0.4} />

      <Suspense fallback={null}>
        <Center>
          <ModelMesh />
        </Center>
        <Environment preset="studio" />
      </Suspense>

      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={2}
        maxDistance={10}
        autoRotate={autoRotate}
        autoRotateSpeed={6}
      />
      <CameraRig preset={camera} />
      <GlBridge onReady={onGlReady} />

      {grain > 0 && (
        <EffectComposer>
          <Noise opacity={grain / 100} blendFunction={BlendFunction.OVERLAY} />
        </EffectComposer>
      )}
    </Canvas>
  );
}
