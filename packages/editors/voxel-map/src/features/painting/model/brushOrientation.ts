// Import Third-party Dependencies
import * as THREE from "three";
import {
  VoxelRotation,
  type BlockShapeID,
  type VoxelRotationStep
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { RotationMode } from "../BrushStore.ts";

// CONSTANTS
const kDirection = new THREE.Vector3();
const kOppositeRotations = [
  VoxelRotation.Deg180,
  VoxelRotation.CW90,
  VoxelRotation.None,
  VoxelRotation.CCW90
] as const;

export interface BrushOrientation {
  rotation: VoxelRotationStep;
  flipY: boolean;
}

export function resolveBrushOrientation(
  camera: THREE.Camera,
  mode: RotationMode,
  flipY: boolean,
  shapeId: BlockShapeID = "cube"
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
  const rotation = quantizeHorizontalRotation(kDirection);
  const reversed = shapeId === "stairCornerOuter" ||
    shapeId === "stairCornerPeak" || shapeId === "slabNotch";

  return {
    rotation: reversed ? kOppositeRotations[rotation] : rotation,
    flipY: flipY || lookingUp
  };
}

function quantizeHorizontalRotation(
  direction: THREE.Vector3
): VoxelRotationStep {
  if (Math.abs(direction.z) >= Math.abs(direction.x)) {
    return direction.z > 0 ? VoxelRotation.None : VoxelRotation.Deg180;
  }

  return direction.x > 0 ? VoxelRotation.CCW90 : VoxelRotation.CW90;
}
