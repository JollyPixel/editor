// Import Third-party Dependencies
import {
  ChunkCoord,
  isValidSplat,
  OVERVIEW_SAMPLE_COUNT,
  SPLAT_CHANNELS,
  SPLAT_TEXEL_COUNT,
  SPLAT_TILE_TEXEL_COUNT,
  TileCoord,
  type SplatTexels,
  type TerrainReader
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  decodeBase64,
  encodeBase64
} from "./base64.ts";
import type { EncodedSplatTilePatch } from "./types.ts";

export interface SplatTilePatch {
  readonly tile: TileCoord;
  readonly splat: SplatTexels;
}

export function encodeSplatBytes(
  { indices, weights }: SplatTexels
): Uint8Array {
  const bytes = new Uint8Array(indices.length + weights.length);
  bytes.set(indices, 0);
  bytes.set(weights, indices.length);

  return bytes;
}

export function decodeSplatBytes(
  bytes: Uint8Array,
  texels: number = SPLAT_TEXEL_COUNT
): SplatTexels | null {
  const half = texels * SPLAT_CHANNELS;
  if (bytes.byteLength !== half * 2) {
    return null;
  }

  const splat = {
    indices: bytes.slice(0, half),
    weights: bytes.slice(half)
  };

  return isValidSplat(splat, texels) ? splat : null;
}

export function encodeSplat(
  splat: SplatTexels
): string {
  return encodeBase64(encodeSplatBytes(splat));
}

export function decodeSplat(
  encoded: string,
  texels: number = SPLAT_TEXEL_COUNT
): SplatTexels | null {
  const bytes = decodeBase64(encoded);

  return bytes === null ? null : decodeSplatBytes(bytes, texels);
}

export function encodeMaterials(
  materials: Uint8Array
): string {
  return encodeBase64(materials);
}

export function decodeMaterials(
  encoded: string
): Uint8Array | null {
  const bytes = decodeBase64(encoded);

  return bytes?.length === OVERVIEW_SAMPLE_COUNT ? bytes : null;
}

export function encodeSplatTilePatch(
  { tile, splat }: SplatTilePatch
): EncodedSplatTilePatch {
  return {
    x: tile.chunk.x,
    z: tile.chunk.z,
    tile: tile.index,
    splat: encodeSplat(splat)
  };
}

export function decodeSplatTilePatch(
  encoded: EncodedSplatTilePatch
): SplatTilePatch | null {
  const splat = decodeSplat(encoded.splat, SPLAT_TILE_TEXEL_COUNT);

  return splat === null ?
    null :
    {
      tile: TileCoord.fromIndex(new ChunkCoord(encoded.x, encoded.z), encoded.tile),
      splat
    };
}

export function currentSplatTilePatches(
  terrain: TerrainReader,
  tiles: Iterable<EncodedSplatTilePatch>
): EncodedSplatTilePatch[] {
  const current: EncodedSplatTilePatch[] = [];
  for (const { x, z, tile: index } of tiles) {
    const tile = TileCoord.fromIndex(new ChunkCoord(x, z), index);
    const splat = terrain.chunk(tile.chunk)?.splat.tile(tile.x, tile.z);
    if (splat !== undefined) {
      current.push(encodeSplatTilePatch({ tile, splat }));
    }
  }

  return current;
}
