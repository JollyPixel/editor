// Import Third-party Dependencies
import type {
  Axis,
  AxisSign
} from "@jolly-pixel/three";
import type { VoxelTransformOptions } from "@jolly-pixel/voxel.renderer";

export function quarterTurnOf(
  turns: AxisSign
): VoxelTransformOptions {
  return {
    rotation: turns === 1 ? 1 : 3
  };
}

export function mirrorOf(
  axis: Axis
): VoxelTransformOptions {
  switch (axis) {
    case "x":
      return { flipX: true };
    case "y":
      return { flipY: true };
    default:
      return { flipZ: true };
  }
}
