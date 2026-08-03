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
 * Returned when a position holds no voxel. Every real `PackedVoxel` is
 * non-negative, so `packed < 0` means absent.
 */
export const VOXEL_ABSENT = -1;

/**
 * One voxel encoded as a non-negative integer.
 * Bits 8-30 hold `blockId`; bits 0-7 hold `transform`.
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
