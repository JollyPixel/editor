// Import Third-party Dependencies
import type {
  VoxelLayer,
  VoxelWorld
} from "@jolly-pixel/voxel.renderer";

interface VoxelChangeCounts {
  placed: number;
  removed: number;
  replaced: number;
}

type LayerChunk = ReturnType<VoxelLayer["chunkAt"]>;

export function summarizeVoxelChange(
  before: VoxelWorld,
  after: VoxelWorld
): string | null {
  const counts: VoxelChangeCounts = {
    placed: 0,
    removed: 0,
    replaced: 0
  };
  for (const layer of after.layers()) {
    compareLayers(before.findLayerById(layer.id), layer, counts);
  }
  for (const layer of before.layers()) {
    if (after.findLayerById(layer.id) === undefined) {
      compareLayers(layer, undefined, counts);
    }
  }

  const parts = (["placed", "removed", "replaced"] as const)
    .filter((key) => counts[key] > 0)
    .map((key) => `${counts[key]} ${key}`);

  return parts.length === 0 ? null : `blocks ${parts.join(", ")}`;
}

function compareLayers(
  before: VoxelLayer | undefined,
  after: VoxelLayer | undefined,
  counts: VoxelChangeCounts
): void {
  for (const chunk of after?.chunks() ?? []) {
    compareChunks(before?.chunkAt(chunk.cx, chunk.cy, chunk.cz), chunk, counts);
  }
  for (const chunk of before?.chunks() ?? []) {
    if (after?.chunkAt(chunk.cx, chunk.cy, chunk.cz) === undefined) {
      compareChunks(chunk, undefined, counts);
    }
  }
}

function compareChunks(
  before: LayerChunk,
  after: LayerChunk,
  counts: VoxelChangeCounts
): void {
  const sample = after ?? before;
  if (sample === undefined) {
    return;
  }

  const cells = sample.size ** 3;
  for (let index = 0; index < cells; index++) {
    const { lx, ly, lz } = sample.fromLinearIndex(index);
    const had = before?.voxelAt(lx, ly, lz) !== undefined;
    const has = after?.voxelAt(lx, ly, lz) !== undefined;
    if (had && has) {
      if (before?.packedAt(lx, ly, lz) !== after?.packedAt(lx, ly, lz)) {
        counts.replaced++;
      }
    }
    else if (has) {
      counts.placed++;
    }
    else if (had) {
      counts.removed++;
    }
  }
}
