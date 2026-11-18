// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { geometryBounds } from "./geometryBounds.ts";
import { isHighlightOverlay } from "./HighlightOverlay.ts";

// CONSTANTS
const kInverseTargetWorld = new THREE.Matrix4();
const kRelativeMatrix = new THREE.Matrix4();
const kMeshLocalBox = new THREE.Box3();

export function computeLocalBoundingBox(
  target: THREE.Object3D
): THREE.Box3 {
  target.updateWorldMatrix(true, true);
  kInverseTargetWorld.copy(target.matrixWorld).invert();
  const box = new THREE.Box3();

  const pending = [target];
  while (pending.length > 0) {
    const object = pending.pop()!;
    if (object !== target && isHighlightOverlay(object)) {
      continue;
    }
    if (object instanceof THREE.Mesh) {
      kRelativeMatrix.multiplyMatrices(
        kInverseTargetWorld,
        object.matrixWorld
      );
      box.union(
        kMeshLocalBox
          .copy(geometryBounds(object.geometry))
          .applyMatrix4(kRelativeMatrix)
      );
    }
    for (const child of object.children) {
      pending.push(child);
    }
  }

  return box;
}
