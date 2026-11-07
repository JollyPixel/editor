// Import Third-party Dependencies
import {
  TILE_SAMPLE_COUNT,
  type TilePatch
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  decodeHeightBytes,
  encodeHeightBytes
} from "./heights.ts";
import {
  encodeTileCoord,
  patchTileCoord
} from "./patchTile.ts";
import type { EncodedTilePatch } from "./types.ts";

export function encodeTilePatch(
  { tile, heights }: TilePatch
): EncodedTilePatch {
  return {
    ...encodeTileCoord(tile),
    heights: encodeHeightBytes(heights)
  };
}

export function decodeTilePatch(
  encoded: EncodedTilePatch
): TilePatch | null {
  const tile = patchTileCoord(encoded);
  const heights = decodeHeightBytes(encoded.heights, TILE_SAMPLE_COUNT);

  return tile === null || heights === null ? null : { tile, heights };
}
