// Import Third-party Dependencies
import type { SplatTilePatch } from "@jolly-pixel/asset.terrain/client";
import {
  CHUNK_SAMPLES,
  ChunkCoord,
  SPLAT_CHANNELS,
  SPLAT_TEXELS,
  SPLAT_TILE_TEXELS,
  SPLAT_WEIGHT_TOTAL,
  TileCoord,
  type SplatTexels,
  type TerrainReader,
  type TileKey
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  falloffWeight,
  type FalloffCurve
} from "../../sculpt/model/falloff.ts";

// CONSTANTS
const kTexelSize = CHUNK_SAMPLES / SPLAT_TEXELS;

export interface PaintStamp {
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  /**
   * Share of the texel moved toward the material at the brush centre, from 0 to 1.
   */
  readonly strength: number;
  readonly falloff: FalloffCurve;
  readonly slot: number;
}

export type PaintTiles = Map<TileKey, SplatTilePatch>;

export function paintStamp(
  terrain: TerrainReader,
  tiles: PaintTiles,
  stamp: PaintStamp
): TileCoord[] {
  const touched = new Map<TileKey, TileCoord>();
  const first = Math.floor((stamp.x - stamp.radius) / kTexelSize);
  const last = Math.ceil((stamp.x + stamp.radius) / kTexelSize);
  const top = Math.floor((stamp.z - stamp.radius) / kTexelSize);
  const bottom = Math.ceil((stamp.z + stamp.radius) / kTexelSize);
  for (let texelZ = top; texelZ <= bottom; texelZ++) {
    for (let texelX = first; texelX <= last; texelX++) {
      const centreX = (texelX + 0.5) * kTexelSize;
      const centreZ = (texelZ + 0.5) * kTexelSize;
      const distance = Math.hypot(centreX - stamp.x, centreZ - stamp.z) / stamp.radius;
      const amount = falloffWeight(stamp.falloff, distance) * stamp.strength;
      if (amount <= 0) {
        continue;
      }

      const located = locateTexel(terrain, tiles, texelX, texelZ);
      if (located !== null) {
        blendTexel(located.splat, located.texel, stamp.slot, Math.min(amount, 1));
        touched.set(located.tile.key, located.tile);
      }
    }
  }

  return [...touched.values()];
}

export function blendTexel(
  { indices, weights }: SplatTexels,
  texel: number,
  slot: number,
  amount: number
): void {
  const offset = texel * SPLAT_CHANNELS;
  const shares = Array.from(
    { length: SPLAT_CHANNELS },
    (_, channel) => weights[offset + channel] / SPLAT_WEIGHT_TOTAL
  );
  let target = Array.from({ length: SPLAT_CHANNELS }, (_, channel) => channel)
    .find((channel) => indices[offset + channel] === slot && shares[channel] > 0);
  if (target === undefined) {
    target = shares.indexOf(Math.min(...shares));
    const freed = shares[target];
    shares[target] = 0;
    const rest = 1 - freed;
    for (let channel = 0; channel < SPLAT_CHANNELS; channel++) {
      shares[channel] = rest > 0 ? shares[channel] / rest : 0;
    }
    indices[offset + target] = slot;
  }
  for (let channel = 0; channel < SPLAT_CHANNELS; channel++) {
    shares[channel] *= 1 - amount;
  }
  shares[target] += amount;

  const quantised = shares.map((share) => Math.round(share * SPLAT_WEIGHT_TOTAL));
  const total = quantised.reduce((sum, weight) => sum + weight, 0);
  const largest = quantised.indexOf(Math.max(...quantised));
  quantised[largest] += SPLAT_WEIGHT_TOTAL - total;
  weights.set(quantised, offset);
}

function locateTexel(
  terrain: TerrainReader,
  tiles: PaintTiles,
  texelX: number,
  texelZ: number
): { tile: TileCoord; splat: SplatTexels; texel: number; } | null {
  const chunk = new ChunkCoord(
    Math.floor(texelX / SPLAT_TEXELS),
    Math.floor(texelZ / SPLAT_TEXELS)
  );
  const localX = texelX - chunk.x * SPLAT_TEXELS;
  const localZ = texelZ - chunk.z * SPLAT_TEXELS;
  const tile = new TileCoord(
    chunk,
    Math.floor(localX / SPLAT_TILE_TEXELS),
    Math.floor(localZ / SPLAT_TILE_TEXELS)
  );
  let patch = tiles.get(tile.key);
  if (patch === undefined) {
    const current = terrain.chunk(chunk)?.splat.tile(tile.x, tile.z);
    if (current === undefined) {
      return null;
    }
    patch = { tile, splat: current };
    tiles.set(tile.key, patch);
  }

  const texel = (localZ % SPLAT_TILE_TEXELS) * SPLAT_TILE_TEXELS + localX % SPLAT_TILE_TEXELS;

  return { tile, splat: patch.splat, texel };
}
