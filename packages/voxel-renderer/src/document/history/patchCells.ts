// Import Internal Dependencies
import { isAir } from "../blocks/BlockId.ts";
import {
  packVoxel,
  VOXEL_ABSENT,
  type PackedVoxel
} from "../world/storage/packedVoxel.ts";
import {
  VOXEL_PATCH_PARTNER_STRIDE,
  VOXEL_PATCH_STRIDE,
  type VoxelPatch
} from "../world/editing/voxelPatch.ts";
import type { VoxelCoord } from "../world/types.ts";

export interface PatchCell {
  readonly position: VoxelCoord;
  readonly packed: PackedVoxel;
  readonly partner: PackedVoxel;
}

export function* patchCells(
  patch: VoxelPatch
): IterableIterator<PatchCell> {
  const { cells, partners = [] } = patch;
  const partnerOf = new Map<number, PackedVoxel>();
  for (let index = 0; index < partners.length; index += VOXEL_PATCH_PARTNER_STRIDE) {
    partnerOf.set(
      partners[index],
      packedOf(partners[index + 1], partners[index + 2])
    );
  }

  for (let offset = 0; offset < cells.length; offset += VOXEL_PATCH_STRIDE) {
    yield {
      position: {
        x: cells[offset],
        y: cells[offset + 1],
        z: cells[offset + 2]
      },
      packed: packedOf(cells[offset + 3], cells[offset + 4]),
      partner: partnerOf.get(offset / VOXEL_PATCH_STRIDE) ?? VOXEL_ABSENT
    };
  }
}

function packedOf(
  blockId: number,
  transform: number
): PackedVoxel {
  return isAir(blockId) ? VOXEL_ABSENT : packVoxel(blockId, transform);
}
