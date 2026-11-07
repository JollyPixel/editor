// Import Third-party Dependencies
import {
  HOLE_BYTES,
  HOLE_TILE_BYTES,
  tierOfHoleBytes,
  type TileCoord
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  encodeTileCoord,
  patchTileCoord
} from "./patchTile.ts";
import type { EncodedHoleTilePatch } from "./types.ts";

export interface HoleTilePatch {
  readonly tile: TileCoord;
  /**
   * One bit per quad, row-major by Z, least significant bit first.
   */
  readonly holes: Uint8Array;
}

export function decodeHoles(
  holes: Uint8Array,
  bytes: number = HOLE_BYTES
): Uint8Array | null {
  return holes.length === bytes ? holes.slice() : null;
}

export function decodeChunkHoleBytes(
  bytes: Uint8Array
): Uint8Array | null {
  return tierOfHoleBytes(bytes.length) === null ? null : bytes.slice();
}

export function encodeHoleTilePatch(
  { tile, holes }: HoleTilePatch
): EncodedHoleTilePatch {
  return {
    ...encodeTileCoord(tile),
    holes: holes.slice()
  };
}

export function decodeHoleTilePatch(
  encoded: EncodedHoleTilePatch
): HoleTilePatch | null {
  const tile = patchTileCoord(encoded);
  const holes = decodeHoles(encoded.holes, HOLE_TILE_BYTES);

  return tile === null || holes === null ? null : { tile, holes };
}
