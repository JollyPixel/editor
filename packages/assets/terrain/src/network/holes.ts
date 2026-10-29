// Import Third-party Dependencies
import {
  ChunkCoord,
  HOLE_BYTES,
  HOLE_TILE_BYTES,
  TileCoord,
  type TerrainReader
} from "@jolly-pixel/terrain.renderer";
import {
  decodeBase64,
  encodeBase64
} from "@jolly-pixel/asset.common";

// Import Internal Dependencies
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

export function encodeHoleTilePatch(
  { tile, holes }: HoleTilePatch
): EncodedHoleTilePatch {
  return {
    x: tile.chunk.x,
    z: tile.chunk.z,
    tile: tile.index,
    holes: encodeHoles(holes)
  };
}

export function decodeHoleTilePatch(
  encoded: EncodedHoleTilePatch
): HoleTilePatch | null {
  const holes = decodeHoles(encoded.holes, HOLE_TILE_BYTES);

  return holes === null ?
    null :
    {
      tile: TileCoord.fromIndex(new ChunkCoord(encoded.x, encoded.z), encoded.tile),
      holes
    };
}

export function currentHoleTilePatches(
  terrain: TerrainReader,
  tiles: Iterable<EncodedHoleTilePatch>
): EncodedHoleTilePatch[] {
  const current: EncodedHoleTilePatch[] = [];
  for (const { x, z, tile: index } of tiles) {
    const tile = TileCoord.fromIndex(new ChunkCoord(x, z), index);
    const holes = terrain.chunk(tile.chunk)?.holes.tile(tile.x, tile.z);
    if (holes !== undefined) {
      current.push(encodeHoleTilePatch({ tile, holes }));
    }
  }

  return current;
}
