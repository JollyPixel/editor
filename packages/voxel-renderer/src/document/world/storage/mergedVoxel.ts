// Import Internal Dependencies
import {
  VOXEL_ABSENT,
  type PackedVoxel
} from "./packedVoxel.ts";

// CONSTANTS
const kMergedBit = 0x80;

export function isMergedVoxel(
  packed: PackedVoxel
): boolean {
  return packed !== VOXEL_ABSENT && (packed & kMergedBit) !== 0;
}

export function markMerged(
  packed: PackedVoxel
): PackedVoxel {
  return packed | kMergedBit;
}

export function unmarkMerged(
  packed: PackedVoxel
): PackedVoxel {
  return packed === VOXEL_ABSENT ? VOXEL_ABSENT : packed & ~kMergedBit;
}

export function cellPrimary(
  packed: PackedVoxel,
  partner: PackedVoxel
): PackedVoxel {
  return packed === VOXEL_ABSENT || partner === VOXEL_ABSENT ?
    packed :
    Math.min(packed, partner);
}

export function cellPartner(
  packed: PackedVoxel,
  partner: PackedVoxel
): PackedVoxel {
  return packed === VOXEL_ABSENT || partner === VOXEL_ABSENT ?
    VOXEL_ABSENT :
    Math.max(packed, partner);
}

export function sameCell(
  packed: PackedVoxel,
  partner: PackedVoxel,
  otherPacked: PackedVoxel,
  otherPartner: PackedVoxel
): boolean {
  return packed === otherPacked && partner === otherPartner;
}
