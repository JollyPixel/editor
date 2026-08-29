// Import Internal Dependencies
import type { VoxelCoord } from "./types.ts";

export function voxelCellOf(
  point: VoxelCoord
): VoxelCoord {
  return {
    x: Math.floor(point.x),
    y: Math.floor(point.y),
    z: Math.floor(point.z)
  };
}

export function voxelPositionOf(
  point: VoxelCoord,
  normal: VoxelCoord,
  side: "front" | "back" = "front"
): VoxelCoord {
  const offset = side === "front" ? 0.5 : -0.5;

  return voxelCellOf({
    x: point.x + (normal.x * offset),
    y: point.y + (normal.y * offset),
    z: point.z + (normal.z * offset)
  });
}
