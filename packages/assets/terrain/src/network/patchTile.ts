// Import Third-party Dependencies
import {
  ChunkCoord,
  tileCount,
  TileCoord,
  type ChunkTier,
  type TerrainChunk,
  type TerrainReader
} from "@jolly-pixel/terrain.renderer";

export interface PatchTile {
  readonly x: number;
  readonly z: number;
  readonly tile: number;
  readonly tier?: 2 | 4;
}

export interface EncodedTileCoord {
  readonly x: number;
  readonly z: number;
  readonly tile: number;
  readonly tier?: 2 | 4;
}

export function patchTileCoord(
  { x, z, tile, tier }: PatchTile
): TileCoord | null {
  const level: ChunkTier = tier ?? 1;

  return tile < tileCount(level) ? TileCoord.fromIndex(new ChunkCoord(x, z), tile, level) : null;
}

export function encodeTileCoord(
  tile: TileCoord
): EncodedTileCoord {
  const encoded = { x: tile.chunk.x, z: tile.chunk.z, tile: tile.index };

  return tile.tier === 1 ? encoded : { ...encoded, tier: tile.tier };
}

export function chunkAtTier(
  terrain: Pick<TerrainReader, "chunk">,
  tile: TileCoord
): TerrainChunk | undefined {
  const chunk = terrain.chunk(tile.chunk);

  return chunk?.tier === tile.tier ? chunk : undefined;
}
