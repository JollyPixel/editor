// Import Internal Dependencies
import type { VoxelEntry } from "../../src/world/index.ts";

/** A minimal packed voxel entry, defaulting to block 1 with no transform. */
export function makeVoxelEntry(
  blockId = 1,
  transform = 0
): VoxelEntry {
  return { blockId, transform };
}
