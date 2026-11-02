import * as THREE from 'three';
export function isMesh(object: THREE.Object3D): object is THREE.Mesh {
  return (object as THREE.Mesh).isMesh === true;
}
export function meshTargets(root: THREE.Object3D) {
  const targets: { path: string; name: string; mesh: THREE.Mesh; volume: number }[] = [];
  function visit(obj: THREE.Object3D, path: string) {
    if (isMesh(obj) && !obj.userData.nesomnDecal) {
      obj.geometry.computeBoundingBox();
      const size = obj.geometry.boundingBox?.getSize(new THREE.Vector3()) ?? new THREE.Vector3();
      targets.push({
        path,
        name: obj.name || 'Mesh ' + path,
        mesh: obj,
        volume: size.x * size.y * size.z,
      });
    }
    obj.children.forEach((child, i) => visit(child, path + '.' + i));
  }
  visit(root, '0');
  return targets;
}
export function targetMesh(root: THREE.Object3D, path?: string) {
  const targets = meshTargets(root);
  return (
    path
      ? targets.find((t) => t.path === path)
      : [...targets].sort((a, b) => b.volume - a.volume)[0]
  )?.mesh;
}
