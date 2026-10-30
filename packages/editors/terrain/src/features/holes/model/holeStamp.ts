// Import Third-party Dependencies
import type { HoleTilePatch } from "@jolly-pixel/asset.terrain/client";
import {
  ChunkCoord,
  TILE_SAMPLES,
  TileCoord,
  type TerrainChunk,
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
  const first = ChunkCoord.containing(stamp.x - stamp.radius, stamp.z - stamp.radius);
  const last = ChunkCoord.containing(stamp.x + stamp.radius, stamp.z + stamp.radius);
  for (let chunkZ = first.z; chunkZ <= last.z; chunkZ++) {
    for (let chunkX = first.x; chunkX <= last.x; chunkX++) {
      const chunk = terrain.chunk(new ChunkCoord(chunkX, chunkZ));
      if (chunk !== undefined) {
        stampChunk(chunk, tiles, stamp, changed);
      }
    }
  }

  return [...changed.values()];
}

function stampChunk(
  chunk: TerrainChunk,
  tiles: HoleTiles,
  stamp: HoleStamp,
  changed: Map<TileKey, TileCoord>
): void {
  const { tier, resolution } = chunk;
  const origin = chunk.coord.originSample;
  function quadRange(
    centre: number,
    start: number
  ): [number, number] {
    return [
      Math.max(0, Math.floor((centre - stamp.radius - start) * tier - 0.5)),
      Math.min(resolution - 1, Math.ceil((centre + stamp.radius - start) * tier - 0.5))
    ];
  }
  const [firstX, lastX] = quadRange(stamp.x, origin.x);
  const [firstZ, lastZ] = quadRange(stamp.z, origin.z);
  for (let quadZ = firstZ; quadZ <= lastZ; quadZ++) {
    for (let quadX = firstX; quadX <= lastX; quadX++) {
      const centreX = origin.x + (quadX + 0.5) / tier;
      const centreZ = origin.z + (quadZ + 0.5) / tier;
      if (Math.hypot(centreX - stamp.x, centreZ - stamp.z) > stamp.radius) {
        continue;
      }

      const tile = new TileCoord(
        chunk.coord,
        Math.floor(quadX / TILE_SAMPLES),
        Math.floor(quadZ / TILE_SAMPLES),
        tier
      );
      let patch = tiles.get(tile.key);
      if (patch?.tile.tier !== tier) {
        patch = { tile, holes: chunk.holes.tile(tile.x, tile.z) };
        tiles.set(tile.key, patch);
      }

      const quad = (quadZ % TILE_SAMPLES) * TILE_SAMPLES + quadX % TILE_SAMPLES;
      const byte = quad >> 3;
      const bit = 1 << (quad & 7);
      const next = stamp.mode === "cut" ? patch.holes[byte] | bit : patch.holes[byte] & ~bit;
      if (next !== patch.holes[byte]) {
        patch.holes[byte] = next;
        changed.set(tile.key, patch.tile);
      }
    }
  }
}
