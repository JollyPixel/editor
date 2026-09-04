// Import Third-party Dependencies
import * as THREE from "three";

/**
 * Union of every mesh descendant's bounding box, in `target`'s own local
 * space - usable directly as position/scale for anything parented to
 * `target` afterward.
 *
 * Extracted out of `SelectionBoundingBox.ts` so `PeerSelectionChips` can
 * reuse it for positioning a chip row, rather than a second copy drifting
 * out of sync.
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

    relativeMatrix.multiplyMatrices(inverseTargetWorld, descendant.matrixWorld);
    meshLocalBox.copy(descendant.geometry.boundingBox).applyMatrix4(relativeMatrix);
    box.union(meshLocalBox);
  });

  return box;
}
