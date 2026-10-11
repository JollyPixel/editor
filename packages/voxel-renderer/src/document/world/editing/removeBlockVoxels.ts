// Import Internal Dependencies
import type { VoxelWorld } from "../VoxelWorld.ts";
import type { VoxelLayer } from "../VoxelLayer.ts";
import type { VoxelCoord } from "../types.ts";
import {
  voxelBlockId,
  VOXEL_ABSENT,
  type PackedVoxel
} from "../storage/packedVoxel.ts";
import { VoxelPatchBuilder } from "./VoxelPatchBuilder.ts";

// CONSTANTS
const kRemoveBatchSize = 4096;

export function removeBlockVoxels(
  world: VoxelWorld,
  blockIds: ReadonlySet<number>
): number {
  let removed = 0;

  for (const layer of world.getLayers()) {
    const positions = Array.from(layer.positionsUsingBlocks(blockIds));
    for (let start = 0; start < positions.length; start += kRemoveBatchSize) {
      const patch = new VoxelPatchBuilder();
      for (const position of positions.slice(start, start + kRemoveBatchSize)) {
        patch.push(position, survivorAt(layer, position, blockIds));
      }

      const { cells, partners } = patch.toPatch();
      world.patchVoxels(layer.name, cells, partners);
    }
    removed += positions.length;
  }

  return removed;
}

function survivorAt(
  layer: VoxelLayer,
  position: VoxelCoord,
  blockIds: ReadonlySet<number>
): PackedVoxel {
  const partner = layer.getPartnerVoxelAt(position);
  if (partner === VOXEL_ABSENT) {
    return VOXEL_ABSENT;
  }

  const survivors = [layer.getPackedVoxelAt(position), partner].filter(
    (part) => !blockIds.has(voxelBlockId(part))
  );

  return survivors.length === 1 ? survivors[0] : VOXEL_ABSENT;
}
