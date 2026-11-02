import { useEffect, useRef, type ComponentRef } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import * as THREE from 'three';
import { frameBounds } from '@/lib/model-3d';
import type { CameraPreset } from '@nesomn/shared';
const directions: Record<CameraPreset, [number, number, number]> = {
  front: [0, 0, 1],
  side: [1, 0, 0],
  top: [0, 1, 0.001],
  threeQuarter: [1, 0.65, 1],
};
export function StudioEnvironment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const room = new RoomEnvironment(),
      pmrem = new THREE.PMREMGenerator(gl);
    const target = pmrem.fromScene(room, 0.04);
    const previous = scene.environment;
    scene.environment = target.texture;
    room.dispose();
    pmrem.dispose();
    return () => {
      scene.environment = previous;
      target.dispose();
    };
  }, [gl, scene]);
  return (
    <>
      <ambientLight intensity={0.45} />
      <directionalLight position={[4, 7, 5]} intensity={2} castShadow />
      <directionalLight position={[-4, 3, -4]} intensity={0.5} />
    </>
  );
}
export function FramedControls({
  object,
  preset = 'threeQuarter',
  reset = 0,
  zoom = 0,
  rotate = false,
  reduced = false,
}: {
  object: THREE.Object3D;
  preset?: CameraPreset;
  reset?: number;
  zoom?: number;
  rotate?: boolean;
  reduced?: boolean;
}) {
  const { camera, size, invalidate } = useThree(),
    controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const limits = useRef({ minDistance: 0.1, maxDistance: 100 });
  useEffect(() => {
    object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object),
      center = box.getCenter(new THREE.Vector3()),
      extent = box.getSize(new THREE.Vector3());
    if (box.isEmpty()) return;
    const perspective = camera as THREE.PerspectiveCamera;
    const fit = frameBounds(
      extent.toArray(),
      size.width / Math.max(size.height, 1),
      perspective.fov ?? 45,
    );
    limits.current = fit;
    const direction = new THREE.Vector3(...directions[preset]).normalize();
    camera.position.copy(center).addScaledVector(direction, fit.distance);
    perspective.near = fit.near;
    perspective.far = fit.far;
    perspective.updateProjectionMatrix();
    camera.lookAt(center);
    if (controls.current) {
      controls.current.target.copy(center);
      controls.current.minDistance = fit.minDistance;
      controls.current.maxDistance = fit.maxDistance;
      controls.current.update();
    }
    invalidate();
  }, [object, camera, preset, reset, size.width, size.height, invalidate]);
  const lastZoom = useRef(zoom);
  useEffect(() => {
    const delta = zoom - lastZoom.current;
    lastZoom.current = zoom;
    if (!delta || !controls.current) return;
    const vector = camera.position.clone().sub(controls.current.target),
      length = THREE.MathUtils.clamp(
        vector.length() * Math.pow(0.8, delta),
        limits.current.minDistance,
        limits.current.maxDistance,
      );
    camera.position.copy(controls.current.target).add(vector.setLength(length));
    controls.current.update();
    invalidate();
  }, [zoom, camera, invalidate]);
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableDamping={!reduced}
      autoRotate={rotate && !reduced}
      autoRotateSpeed={1.2}
      minDistance={limits.current.minDistance}
      maxDistance={limits.current.maxDistance}
    />
  );
}
