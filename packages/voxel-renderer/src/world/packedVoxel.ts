// Import Internal Dependencies
import type { VoxelEntry } from "./types.ts";

// CONSTANTS
const kTransformBits = 8;
const kTransformMask = 0xFF;

/**
 * Highest storable block id. `packTransform()` uses 5 bits, leaving 23 bits for block IDs.
 */
export const MAX_BLOCK_ID = 0x7FFFFF;

/**
 * Negative sentinel returned when no voxel is present.
 */
export const VOXEL_ABSENT = -1;

/**
 * Packed voxel with block ID in bits 8-30 and transform in bits 0-7.
 */
export type PackedVoxel = number;

export function packVoxel(
  blockId: number,
  transform: number
): PackedVoxel {
  if (blockId < 0 || blockId > MAX_BLOCK_ID) {
    throw new RangeError(
      `Block id ${blockId} is out of range (0..${MAX_BLOCK_ID}).`
    );
  }

  return (blockId << kTransformBits) | (transform & kTransformMask);
}

export function voxelBlockId(
  packed: PackedVoxel
): number {
  return packed >>> kTransformBits;
}

export function voxelTransform(
  packed: PackedVoxel
): number {
  return packed & kTransformMask;
}

/**
 * Builds the object form. Prefer `voxelBlockId()` and `voxelTransform()` on
 * hot paths; this allocates.
 */
export function unpackVoxel(
  packed: PackedVoxel
): VoxelEntry {
  return {
    blockId: voxelBlockId(packed),
    transform: voxelTransform(packed)
  };
}
