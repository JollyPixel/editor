// Import Third-party Dependencies
import {
  ChunkCoord,
  TILE_SAMPLE_COUNT,
  TileCoord,
  type TerrainReader,
  type TilePatch
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  decodeHeights,
  encodeHeights
} from "./heights.ts";
import type { EncodedTilePatch } from "./types.ts";

export function encodeTilePatch(
  { tile, heights }: TilePatch
): EncodedTilePatch {
  return {
    x: tile.chunk.x,
    z: tile.chunk.z,
    tile: tile.index,
    heights: encodeHeights(heights)
  };
}

export function decodeTilePatch(
  encoded: EncodedTilePatch
): TilePatch | null {
  const heights = decodeHeights(encoded.heights, TILE_SAMPLE_COUNT);

  return heights === null ?
    null :
    {
      tile: TileCoord.fromIndex(new ChunkCoord(encoded.x, encoded.z), encoded.tile),
      heights
    };
}

export function currentTilePatches(
  terrain: TerrainReader,
  tiles: Iterable<EncodedTilePatch>
): EncodedTilePatch[] {
  const current: EncodedTilePatch[] = [];
  for (const { x, z, tile: index } of tiles) {
    const tile = TileCoord.fromIndex(new ChunkCoord(x, z), index);
    const heights = terrain.chunk(tile.chunk)?.tileHeights(tile.x, tile.z);
    if (heights !== undefined) {
      current.push(encodeTilePatch({ tile, heights }));
    }
  }

  return current;
}
