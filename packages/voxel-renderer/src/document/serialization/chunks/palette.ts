// Import Internal Dependencies
import {
  MAX_BLOCK_ID,
  packVoxel,
  type PackedVoxel
} from "../../world/storage/packedVoxel.ts";

// CONSTANTS
const kMaxTransform = 0xFF;

export interface VoxelPalette {
  readonly entries: readonly PackedVoxel[];
  readonly values: ReadonlyMap<PackedVoxel, number>;
}

export function buildPalette(
  voxelSets: Iterable<ArrayLike<PackedVoxel>>
): VoxelPalette {
  const counts = new Map<PackedVoxel, number>();
  for (const voxels of voxelSets) {
    for (let i = 0; i < voxels.length; i++) {
      counts.set(voxels[i], (counts.get(voxels[i]) ?? 0) + 1);
    }
  }

  const entries = [...counts]
    .sort(([a, countA], [b, countB]) => countB - countA || a - b)
    .map(([packed]) => packed);
  const values = new Map<PackedVoxel, number>();
  for (let i = 0; i < entries.length; i++) {
    values.set(entries[i], i + 1);
  }

  return { entries, values };
}

export function toPaletteValues(
  voxels: ArrayLike<PackedVoxel>,
  palette: VoxelPalette
): Uint32Array {
  const values = new Uint32Array(voxels.length);
  for (let i = 0; i < voxels.length; i++) {
    values[i] = palette.values.get(voxels[i])!;
  }

  return values;
}

export function resolvePaletteValues(
  values: Uint32Array,
  entries: ArrayLike<PackedVoxel>
): Uint32Array {
  for (let i = 0; i < values.length; i++) {
    values[i] = entries[values[i] - 1];
  }

  return values;
}

export function packPaletteEntry(
  block: number,
  transform: number
): PackedVoxel {
  if (!Number.isInteger(block) || block < 1 || block > MAX_BLOCK_ID) {
    throw new RangeError(
      `block ${block} is out of range (1..${MAX_BLOCK_ID})`
    );
  }
  if (
    !Number.isInteger(transform) ||
    transform < 0 ||
    transform > kMaxTransform
  ) {
    throw new RangeError(
      `transform ${transform} is out of range (0..${kMaxTransform})`
    );
  }

  return packVoxel(block, transform);
}
