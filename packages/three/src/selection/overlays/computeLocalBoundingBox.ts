// Import Third-party Dependencies
import * as THREE from "three";

/**
 * Union of every mesh descendant's bounding box, expressed in `target`'s own
 * local space (i.e. as if `target` had an identity transform) - the result
 * can be applied directly as position/scale (or used to derive a position,
 * e.g. floating above the top) for anything parented to `target` afterward.
 *
 * Extracted out of `SelectionBoundingBox.ts` (its own original, sole
 * consumer) so `PeerSelectionChips` can reuse the exact same computation for
 * positioning a chip row above a multi-selected object, rather than a second
 * independent copy drifting out of sync with this one.
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
