// Import Third-party Dependencies
import type { HoleTilePatch } from "@jolly-pixel/asset.terrain/client";
import {
  CHUNK_SAMPLES,
  ChunkCoord,
  TILE_SAMPLES,
  TileCoord,
  type TerrainReader,
  type TileKey
} from "@jolly-pixel/terrain.renderer";

export const HOLE_MODES = ["cut", "fill"] as const;

export type HoleMode = typeof HOLE_MODES[number];

export interface HoleStamp {
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  readonly mode: HoleMode;
}

export type HoleTiles = Map<TileKey, HoleTilePatch>;

export function holeStamp(
  terrain: TerrainReader,
  tiles: HoleTiles,
  stamp: HoleStamp
): TileCoord[] {
  const changed = new Map<TileKey, TileCoord>();
  const first = Math.floor(stamp.x - stamp.radius - 0.5);
  const last = Math.ceil(stamp.x + stamp.radius - 0.5);
  const top = Math.floor(stamp.z - stamp.radius - 0.5);
  const bottom = Math.ceil(stamp.z + stamp.radius - 0.5);
  for (let quadZ = top; quadZ <= bottom; quadZ++) {
    for (let quadX = first; quadX <= last; quadX++) {
      if (Math.hypot(quadX + 0.5 - stamp.x, quadZ + 0.5 - stamp.z) > stamp.radius) {
        continue;
      }

      const located = locateQuad(terrain, tiles, quadX, quadZ);
      if (located === null) {
        continue;
      }

      const { tile, holes, quad } = located;
      const byte = quad >> 3;
      const bit = 1 << (quad & 7);
      const next = stamp.mode === "cut" ? holes[byte] | bit : holes[byte] & ~bit;
      if (next !== holes[byte]) {
        holes[byte] = next;
        changed.set(tile.key, tile);
      }
    }
  }

  return [...changed.values()];
}

function locateQuad(
  terrain: TerrainReader,
  tiles: HoleTiles,
  quadX: number,
  quadZ: number
): { tile: TileCoord; holes: Uint8Array; quad: number; } | null {
  const chunk = ChunkCoord.containing(quadX, quadZ);
  const localX = quadX - chunk.x * CHUNK_SAMPLES;
  const localZ = quadZ - chunk.z * CHUNK_SAMPLES;
  const tile = new TileCoord(
    chunk,
    Math.floor(localX / TILE_SAMPLES),
    Math.floor(localZ / TILE_SAMPLES)
  );
  let patch = tiles.get(tile.key);
  if (patch === undefined) {
    const current = terrain.chunk(chunk)?.holes.tile(tile.x, tile.z);
    if (current === undefined) {
      return null;
    }
    patch = { tile, holes: current };
    tiles.set(tile.key, patch);
  }

  const quad = (localZ % TILE_SAMPLES) * TILE_SAMPLES + localX % TILE_SAMPLES;

  return { tile, holes: patch.holes, quad };
}
