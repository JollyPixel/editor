// Import Internal Dependencies
import type { VoxelObjectJSON } from "./types.ts";

export interface VoxelObjectFootprint {
  width: number;
  height: number;
}

export function normalizeVoxelExtent(
  value: number
): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }

  return Math.max(1, Math.round(value));
}

export function voxelObjectFootprint(
  object: VoxelObjectJSON
): VoxelObjectFootprint {
  return {
    width: normalizeVoxelExtent(
      object.width ?? 1
    ),
    height: normalizeVoxelExtent(
      object.height ?? 1
    )
  };
}
