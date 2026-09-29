// Import Internal Dependencies
import type {
  VoxelRemoveOptions,
  VoxelWorld
} from "../VoxelWorld.ts";

// CONSTANTS
const kRemoveBatchSize = 4096;

export function removeBlockVoxels(
  world: VoxelWorld,
  blockIds: ReadonlySet<number>
): number {
  let removed = 0;

  for (const layer of world.getLayers()) {
    const entries = Array.from(
      layer.positionsOf(blockIds),
      (position): VoxelRemoveOptions => {
        return { position };
      }
    );
    for (let start = 0; start < entries.length; start += kRemoveBatchSize) {
      world.removeVoxelBulk(
        layer.name,
        entries.slice(start, start + kRemoveBatchSize)
      );
    }
    removed += entries.length;
  }

  return removed;
}
