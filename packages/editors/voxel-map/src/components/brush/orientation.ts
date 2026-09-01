// Import Third-party Dependencies
import * as THREE from "three";
import { VoxelRotation } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { RotationMode } from "../../EditorState.ts";

// CONSTANTS
const kDirection = new THREE.Vector3();

export type VoxelRotationValue = typeof VoxelRotation[
  keyof typeof VoxelRotation
];

export function resolveRotation(
  camera: THREE.Camera,
  mode: RotationMode
): VoxelRotationValue {
  if (mode !== "auto") {
    return mode;
  }

  camera.getWorldDirection(kDirection);
  kDirection.y = 0;
  kDirection.normalize();

  const absX = Math.abs(kDirection.x);
  const absZ = Math.abs(kDirection.z);

  if (absZ >= absX) {
    return kDirection.z > 0 ?
      VoxelRotation.None :
      VoxelRotation.Deg180;
  }

  return kDirection.x > 0 ?
    VoxelRotation.CCW90 :
    VoxelRotation.CW90;
}

export function resolveFlipY(
  camera: THREE.Camera,
  mode: RotationMode,
  flipY: boolean
): boolean {
  if (flipY) {
    return true;
  }

  if (mode === "auto") {
    camera.getWorldDirection(kDirection);

    return kDirection.y > 0;
  }

  return false;
}
