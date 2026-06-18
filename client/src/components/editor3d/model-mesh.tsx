import { useMemo } from 'react';
import { Decal, useTexture } from '@react-three/drei';
import type { Decal3D } from '@nesomn/shared';
import { useScene3DEditor } from '@/stores/scene-3d-store';

/**
 * Model mockup 3D. Memakai geometry primitive ber-UV (cylinder)
 * sebagai dummy dev yang andal tanpa aset GLB eksternal. Material PBR
 * memakai warna dari store; decal ditempel mengikuti UV via <Decal> drei.
 *
 * Catatan: bila kelak tersedia GLB ber-UV, ganti geometry dengan
 * useGLTF tanpa mengubah kontrak store (modelKey sudah disiapkan).
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

export function ModelMesh() {
  const materialColor = useScene3DEditor((s) => s.materialColor);
  const decals = useScene3DEditor((s) => s.decals);

  // Geometry stabil antar render agar decal tidak ter-reset.
  const geometry = useMemo(() => null, []);
  void geometry;

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
