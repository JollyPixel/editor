// Import Internal Dependencies
import type { VoxelEntry } from "../../src/document/world/index.ts";

export function makeVoxelEntry(
  blockId = 1,
  transform = 0
): VoxelEntry {
  return { blockId, transform };
}
