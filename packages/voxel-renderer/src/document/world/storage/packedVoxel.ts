// Import Internal Dependencies
import {
  AIR_BLOCK_ID,
  isAir
} from "../../blocks/BlockId.ts";
import type { VoxelEntry } from "../types.ts";
import {
  VoxelTransform,
  VOXEL_TRANSFORM_MASK
} from "../../geometry/VoxelTransform.ts";

// CONSTANTS
const kTransformBits = 8;

/**
 * Highest storable block id. The transform takes a byte, leaving 23 bits.
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
  if (isAir(blockId)) {
    throw new RangeError(
      `Block id ${AIR_BLOCK_ID} is reserved for air; remove the voxel instead.`
    );
  }
  if (blockId < 0 || blockId > MAX_BLOCK_ID) {
    throw new RangeError(
      `Block id ${blockId} is out of range (1..${MAX_BLOCK_ID}).`
    );
  }

  return (blockId << kTransformBits) | (transform & VOXEL_TRANSFORM_MASK);
}

export function voxelBlockId(
  packed: PackedVoxel
): number {
  return packed >>> kTransformBits;
}

export function voxelTransform(
  packed: PackedVoxel
): number {
  return packed & VOXEL_TRANSFORM_MASK;
}

export function turnVoxel(
  packed: PackedVoxel,
  transform: VoxelTransform
): PackedVoxel {
  if (packed === VOXEL_ABSENT) {
    return VOXEL_ABSENT;
  }

  const turned = VoxelTransform
    .fromPacked(voxelTransform(packed))
    .followedBy(transform);

  return packVoxel(voxelBlockId(packed), turned.packed);
}

export function unpackVoxel(
  packed: PackedVoxel
): VoxelEntry {
  return {
    blockId: voxelBlockId(packed),
    transform: voxelTransform(packed)
  };
}
