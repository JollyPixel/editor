// Import Third-party Dependencies
import * as THREE from "three";
import {
  VoxelRotation,
  type VoxelRotationStep
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { RotationMode } from "../../../state/index.ts";

// CONSTANTS
const kDirection = new THREE.Vector3();

export interface BrushOrientation {
  rotation: VoxelRotationStep;
  flipY: boolean;
}

export function brushOrientationOf(
  camera: THREE.Camera,
  mode: RotationMode,
  flipY: boolean
): BrushOrientation {
  if (mode !== "auto") {
    return {
      rotation: mode,
      flipY
    };
  }

  camera.getWorldDirection(kDirection);
  const lookingUp = kDirection.y > 0;
  kDirection.y = 0;
  kDirection.normalize();

  return {
    rotation: horizontalRotationOf(kDirection),
    flipY: flipY || lookingUp
  };
}

function horizontalRotationOf(
  direction: THREE.Vector3
): VoxelRotationStep {
  if (Math.abs(direction.z) >= Math.abs(direction.x)) {
    return direction.z > 0 ? VoxelRotation.None : VoxelRotation.Deg180;
  }

  return direction.x > 0 ? VoxelRotation.CCW90 : VoxelRotation.CW90;
}
