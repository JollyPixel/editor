// Import Internal Dependencies
import type { VoxelCoord } from "./types.ts";

// CONSTANTS
// Pulls the point just inside the cell owning the surface it sits on.
const kSurfaceEpsilon = 1e-4;

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
  const cell = voxelCellOf({
    x: point.x - (normal.x * kSurfaceEpsilon),
    y: point.y - (normal.y * kSurfaceEpsilon),
    z: point.z - (normal.z * kSurfaceEpsilon)
  });

  if (side === "back") {
    return cell;
  }

  const step = majorAxisStep(normal);

  return {
    x: cell.x + step.x,
    y: cell.y + step.y,
    z: cell.z + step.z
  };
}

function majorAxisStep(
  normal: VoxelCoord
): VoxelCoord {
  const ax = Math.abs(normal.x);
  const ay = Math.abs(normal.y);
  const az = Math.abs(normal.z);

  if (ay >= ax && ay >= az) {
    return {
      x: 0,
      y: Math.sign(normal.y),
      z: 0
    };
  }

  return ax >= az ?
    { x: Math.sign(normal.x), y: 0, z: 0 } :
    { x: 0, y: 0, z: Math.sign(normal.z) };
}
