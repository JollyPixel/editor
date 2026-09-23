/**
 * Number of values per cell in a `VoxelPatchCells` array.
 */
export const VOXEL_PATCH_STRIDE = 5;

/**
 * Flat list of cell writes, `VOXEL_PATCH_STRIDE` numbers per cell:
 * `x, y, z, blockId, transform`. A `blockId` of `0` (air) removes the voxel.
 * Positions are world-space.
 */
export type VoxelPatchCells = number[];

export interface VoxelPatchCell {
  x: number;
  y: number;
  z: number;
  blockId: number;
  transform: number;
}

export function assertVoxelPatchCells(
  cells: readonly number[]
): void {
  if (cells.length % VOXEL_PATCH_STRIDE !== 0) {
    throw new RangeError(
      `Voxel patch length ${cells.length} is not a multiple of ` +
      `${VOXEL_PATCH_STRIDE}.`
    );
  }
}

export function* voxelPatchCells(
  cells: readonly number[]
): IterableIterator<VoxelPatchCell> {
  assertVoxelPatchCells(cells);

  for (let index = 0; index < cells.length; index += VOXEL_PATCH_STRIDE) {
    yield {
      x: cells[index],
      y: cells[index + 1],
      z: cells[index + 2],
      blockId: cells[index + 3],
      transform: cells[index + 4]
    };
  }
}
