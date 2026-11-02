import { useEffect, useState } from 'react';
import { createPortal } from '@react-three/fiber';
import { Decal, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { Decal3D } from '@nesomn/shared';
import { useScene3DEditor } from '@/stores/scene-3d-store';
import { targetMesh } from '@/lib/mesh-target';
function DecalItem({ decal }: { decal: Decal3D }) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null),
    [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    setError(false);
    setTexture(null);
    const image = new Image();
    image.crossOrigin = 'anonymous';
    const owned = new THREE.Texture(image);
    owned.colorSpace = THREE.SRGBColorSpace;
    image.onload = () => {
      if (active) {
        owned.needsUpdate = true;
        setTexture(owned);
      }
    };
    image.onerror = () => {
      if (active) setError(true);
    };
    image.src = decal.src;
    return () => {
      active = false;
      image.onload = null;
      image.onerror = null;
      image.src = '';
      owned.dispose();
    };
  }, [decal.src]);
  if (error)
    return (
      <Html>
        <span role="alert">Desain tidak dapat dimuat.</span>
      </Html>
    );
  if (!texture) return null;
  return (
    <Decal
      userData={{ nesomnDecal: true }}
      position={decal.position}
      rotation={decal.rotation}
      scale={decal.scale}
    >
      <meshStandardMaterial
        map={texture}
        transparent
        polygonOffset
        polygonOffsetFactor={-4}
        roughness={0.6}
      />
    </Decal>
  );
}
export function ModelMesh({ object }: { object: THREE.Object3D }) {
  const color = useScene3DEditor((s) => s.materialColor),
    decals = useScene3DEditor((s) => s.decals);
  useEffect(() => {
    object.traverse((obj) => {
      if (obj instanceof THREE.Mesh && !obj.userData.nesomnDecal) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        for (const material of Array.isArray(obj.material) ? obj.material : [obj.material])
          if ('color' in material) (material as THREE.MeshStandardMaterial).color.set(color);
      }
    });
  }, [object, color]);
  return (
    <>
      <primitive object={object} dispose={null} />
      {decals.map((d) => {
        const mesh = targetMesh(object, d.meshPath);
        return mesh ? createPortal(<DecalItem key={d.id} decal={d} />, mesh) : null;
      })}
    </>
  );
}
