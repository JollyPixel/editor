// Import Internal Dependencies
import { MAX_PATCH_TILES } from "./TerrainCommand.schema.ts";

export function* patchBatches<T>(
  tiles: readonly T[]
): IterableIterator<T[]> {
  for (let start = 0; start < tiles.length; start += MAX_PATCH_TILES) {
    yield tiles.slice(start, start + MAX_PATCH_TILES);
  }
}
