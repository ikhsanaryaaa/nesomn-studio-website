import { useMemo } from 'react';
import { Decal, useTexture, useGLTF } from '@react-three/drei';
import type { Decal3D } from '@nesomn/shared';
import { useScene3DEditor } from '@/stores/scene-3d-store';

/**
 * Model mockup 3D. Bila store.modelUrl berisi GLB (mis. dimuat dari katalog
 * via slug), model itu dirender. Bila tidak, dipakai geometry primitive
 * ber-UV (cylinder) sebagai dummy dev yang andal tanpa aset eksternal.
 * Material PBR memakai warna dari store; decal ditempel mengikuti UV.
 */

/** Satu decal yang diproyeksikan ke permukaan model. */
function DecalItem({ decal }: { decal: Decal3D }) {
  const texture = useTexture(decal.src);
  return (
    <Decal
      position={decal.position}
      rotation={decal.rotation}
      scale={decal.scale}
    >
      <meshStandardMaterial
        map={texture}
        transparent
        polygonOffset
        polygonOffsetFactor={-1}
        roughness={0.6}
      />
    </Decal>
  );
}

/** Render GLB dari URL (model katalog) + decal sebagai child. */
function GlbModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const decals = useScene3DEditor((s) => s.decals);
  // Clone agar aman bila dipakai beberapa kali / re-render.
  const cloned = useMemo(() => scene.clone(), [scene]);
  return (
    <group>
      <primitive object={cloned} />
      {decals.map((d) => (
        <DecalItem key={d.id} decal={d} />
      ))}
    </group>
  );
}

export function ModelMesh() {
  const materialColor = useScene3DEditor((s) => s.materialColor);
  const modelUrl = useScene3DEditor((s) => s.modelUrl);
  const decals = useScene3DEditor((s) => s.decals);

  if (modelUrl) {
    return <GlbModel url={modelUrl} />;
  }

  return (
    <mesh castShadow receiveShadow rotation={[0, 0, 0]}>
      <cylinderGeometry args={[1, 1, 2, 64, 1, false]} />
      <meshStandardMaterial color={materialColor} roughness={0.45} metalness={0.05} />
      {decals.map((d) => (
        <DecalItem key={d.id} decal={d} />
      ))}
    </mesh>
  );
}
