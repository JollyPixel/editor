// Import Third-party Dependencies
import {
  HOLE_BYTES,
  HOLE_TILE_BYTES,
  tierOfHoleBytes,
  type TerrainReader,
  type TileCoord
} from "@jolly-pixel/terrain.renderer";
import {
  decodeBase64,
  encodeBase64
} from "@jolly-pixel/asset.common";

// Import Internal Dependencies
import {
  chunkAtTier,
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

export function encodeHoles(
  holes: Uint8Array
): string {
  return encodeBase64(holes);
}

export function decodeHoles(
  encoded: string,
  bytes: number = HOLE_BYTES
): Uint8Array | null {
  const holes = decodeBase64(encoded);

  return holes?.length === bytes ? holes : null;
}

export function decodeChunkHoles(
  encoded: string
): Uint8Array | null {
  const holes = decodeBase64(encoded);

  return holes === null || tierOfHoleBytes(holes.length) === null ? null : holes;
}

export function encodeHoleTilePatch(
  { tile, holes }: HoleTilePatch
): EncodedHoleTilePatch {
  return {
    ...encodeTileCoord(tile),
    holes: encodeHoles(holes)
  };
}

export function decodeHoleTilePatch(
  encoded: EncodedHoleTilePatch
): HoleTilePatch | null {
  const tile = patchTileCoord(encoded);
  const holes = decodeHoles(encoded.holes, HOLE_TILE_BYTES);

  return tile === null || holes === null ? null : { tile, holes };
}

export function currentHoleTilePatches(
  terrain: Pick<TerrainReader, "chunk">,
  tiles: Iterable<EncodedHoleTilePatch>
): EncodedHoleTilePatch[] {
  const current: EncodedHoleTilePatch[] = [];
  for (const encoded of tiles) {
    const tile = patchTileCoord(encoded);
    const holes = tile === null ? undefined : chunkAtTier(terrain, tile)?.holes.tile(tile.x, tile.z);
    if (tile !== null && holes !== undefined) {
      current.push(encodeHoleTilePatch({ tile, holes }));
    }
  }

  return current;
}
