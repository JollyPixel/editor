// Import Internal Dependencies
import {
  packVoxel,
  VOXEL_ABSENT,
  type VoxelChunk,
  type VoxelEntry
} from "../../src/document/world/index.ts";

export function makeVoxelEntry(
  blockId = 1,
  transform = 0
): VoxelEntry {
  return { blockId, transform };
}

export function writeChunkVoxel(
  chunk: VoxelChunk,
  [lx, ly, lz]: [number, number, number],
  entry: VoxelEntry
): void {
  const { partner } = entry;

  chunk.writePackedAt(
    lx,
    ly,
    lz,
    packVoxel(entry.blockId, entry.transform),
    partner === undefined ?
      VOXEL_ABSENT :
      packVoxel(partner.blockId, partner.transform)
  );
}
