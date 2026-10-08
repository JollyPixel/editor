// Import Internal Dependencies
import { isAir } from "../../blocks/BlockId.ts";
import {
  packVoxel,
  VOXEL_ABSENT,
  type PackedVoxel
} from "../storage/packedVoxel.ts";
import type { VoxelCoord } from "../types.ts";

/**
 * Number of values per cell in a `VoxelPatchCells` array.
 */
export const VOXEL_PATCH_STRIDE = 5;

export const VOXEL_PATCH_PARTNER_STRIDE = 3;

/**
 * Flat list of cell writes, `VOXEL_PATCH_STRIDE` numbers per cell:
 * `x, y, z, blockId, transform`. A `blockId` of `0` (air) removes the voxel.
 * Positions are world-space.
 */
export type VoxelPatchCells = number[];

export type VoxelPatchPartners = number[];

export interface VoxelPatch {
  cells: VoxelPatchCells;
  /**
   * Second shape of each merged cell, `VOXEL_PATCH_PARTNER_STRIDE` numbers
   * per entry: `cell, blockId, transform`, where `cell` indexes a non-air
   * cell of `cells`. Omitted when no cell is merged.
   */
  partners?: VoxelPatchPartners;
}

export interface VoxelPatchCell {
  x: number;
  y: number;
  z: number;
  blockId: number;
  transform: number;
}

export interface VoxelPatchWrite {
  readonly position: VoxelCoord;
  /**
   * `VOXEL_ABSENT` when the cell is cleared.
   */
  readonly packed: PackedVoxel;
  /**
   * `VOXEL_ABSENT` unless the cell is merged.
   */
  readonly partner: PackedVoxel;
}

export function voxelPatch(
  cells: VoxelPatchCells,
  partners: VoxelPatchPartners = []
): VoxelPatch {
  return partners.length === 0 ?
    { cells } :
    {
      cells,
      partners
    };
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

export function assertVoxelPatch(
  patch: VoxelPatch
): void {
  const { cells, partners = [] } = patch;
  assertVoxelPatchCells(cells);
  if (partners.length % VOXEL_PATCH_PARTNER_STRIDE !== 0) {
    throw new RangeError(
      `Voxel patch partners length ${partners.length} is not a multiple of ` +
      `${VOXEL_PATCH_PARTNER_STRIDE}.`
    );
  }

  const cellCount = cells.length / VOXEL_PATCH_STRIDE;
  for (
    let index = 0;
    index < partners.length;
    index += VOXEL_PATCH_PARTNER_STRIDE
  ) {
    const cell = partners[index];
    if (
      !Number.isInteger(cell) ||
      cell < 0 ||
      cell >= cellCount ||
      isAir(cells[(cell * VOXEL_PATCH_STRIDE) + 3])
    ) {
      throw new RangeError(
        `Voxel patch partner targets cell ${cell}, which writes no voxel.`
      );
    }
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

export function* voxelPatchWrites(
  patch: VoxelPatch
): IterableIterator<VoxelPatchWrite> {
  const { cells, partners = [] } = patch;
  const partnerOf = new Map<number, PackedVoxel>();
  for (
    let index = 0;
    index < partners.length;
    index += VOXEL_PATCH_PARTNER_STRIDE
  ) {
    partnerOf.set(
      partners[index],
      packPatchCell(partners[index + 1], partners[index + 2])
    );
  }

  for (let offset = 0; offset < cells.length; offset += VOXEL_PATCH_STRIDE) {
    yield {
      position: {
        x: cells[offset],
        y: cells[offset + 1],
        z: cells[offset + 2]
      },
      packed: packPatchCell(cells[offset + 3], cells[offset + 4]),
      partner: partnerOf.get(offset / VOXEL_PATCH_STRIDE) ?? VOXEL_ABSENT
    };
  }
}

export function pickVoxelPatch(
  patch: VoxelPatch,
  cellIndices: Iterable<number>
): VoxelPatch {
  const { cells: source, partners: sourcePartners = [] } = patch;
  const picked = new Int32Array(source.length / VOXEL_PATCH_STRIDE).fill(-1);
  const cells: VoxelPatchCells = [];
  for (const cell of cellIndices) {
    const offset = cell * VOXEL_PATCH_STRIDE;
    picked[cell] = cells.length / VOXEL_PATCH_STRIDE;
    cells.push(...source.slice(offset, offset + VOXEL_PATCH_STRIDE));
  }

  const partners: VoxelPatchPartners = [];
  for (
    let index = 0;
    index < sourcePartners.length;
    index += VOXEL_PATCH_PARTNER_STRIDE
  ) {
    const cell = picked[sourcePartners[index]];
    if (cell !== -1) {
      partners.push(
        cell,
        sourcePartners[index + 1],
        sourcePartners[index + 2]
      );
    }
  }

  return voxelPatch(cells, partners);
}

function packPatchCell(
  blockId: number,
  transform: number
): PackedVoxel {
  return isAir(blockId) ? VOXEL_ABSENT : packVoxel(blockId, transform);
}
