// Import Third-party Dependencies
import * as THREE from "three";

/**
 * Computes descendant mesh bounds in `target`'s local space.
 */
export function computeLocalBoundingBox(
  target: THREE.Object3D
): THREE.Box3 {
  target.updateWorldMatrix(true, true);
  const inverseTargetWorld = target.matrixWorld.clone().invert();
  const relativeMatrix = new THREE.Matrix4();
  const meshLocalBox = new THREE.Box3();
  const box = new THREE.Box3();

  target.traverse((descendant) => {
    if (!(descendant instanceof THREE.Mesh)) {
      return;
    }

    descendant.geometry.computeBoundingBox();
    if (!descendant.geometry.boundingBox) {
      return;
    }

    relativeMatrix.multiplyMatrices(
      inverseTargetWorld,
      descendant.matrixWorld
    );
    meshLocalBox
      .copy(descendant.geometry.boundingBox)
      .applyMatrix4(relativeMatrix);
    box.union(meshLocalBox);
  });

  return box;
}
