// Import Third-party Dependencies
import {
  TILE_SAMPLE_COUNT,
  type TerrainReader,
  type TilePatch
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  decodeHeights,
  encodeHeights
} from "./heights.ts";
import {
  chunkAtTier,
  encodeTileCoord,
  patchTileCoord
} from "./patchTile.ts";
import type { EncodedTilePatch } from "./types.ts";

export function encodeTilePatch(
  { tile, heights }: TilePatch
): EncodedTilePatch {
  return {
    ...encodeTileCoord(tile),
    heights: encodeHeights(heights)
  };
}

export function decodeTilePatch(
  encoded: EncodedTilePatch
): TilePatch | null {
  const tile = patchTileCoord(encoded);
  const heights = decodeHeights(encoded.heights, TILE_SAMPLE_COUNT);

  return tile === null || heights === null ? null : { tile, heights };
}

export function currentTilePatches(
  terrain: TerrainReader,
  tiles: Iterable<EncodedTilePatch>
): EncodedTilePatch[] {
  const current: EncodedTilePatch[] = [];
  for (const encoded of tiles) {
    const tile = patchTileCoord(encoded);
    const heights = tile === null ? undefined : chunkAtTier(terrain, tile)?.tileHeights(tile.x, tile.z);
    if (tile !== null && heights !== undefined) {
      current.push(encodeTilePatch({ tile, heights }));
    }
  }

  return current;
}
