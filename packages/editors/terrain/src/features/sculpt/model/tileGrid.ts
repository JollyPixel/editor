// Import Third-party Dependencies
import {
  CHUNK_SAMPLES,
  ChunkCoord,
  HEIGHT_RANGE,
  TileCoord,
  tilesPerSide,
  type TerrainChunk,
  type TerrainReader
} from "@jolly-pixel/terrain.renderer";

export interface GroundRect {
  readonly minX: number;
  readonly minZ: number;
  readonly maxX: number;
  readonly maxZ: number;
}

export function squareAround(
  { x, z, radius }: { readonly x: number; readonly z: number; readonly radius: number; }
): GroundRect {
  return { minX: x - radius, minZ: z - radius, maxX: x + radius, maxZ: z + radius };
}

export function* tilesInRect(
  terrain: TerrainReader,
  rect: GroundRect
): IterableIterator<TileCoord> {
  const first = ChunkCoord.containing(rect.minX, rect.minZ);
  const last = ChunkCoord.containing(rect.maxX, rect.maxZ);
  for (let chunkZ = first.z; chunkZ <= last.z; chunkZ++) {
    for (let chunkX = first.x; chunkX <= last.x; chunkX++) {
      const chunk = terrain.chunk(new ChunkCoord(chunkX, chunkZ));
      if (chunk !== undefined) {
        yield* chunkTilesInRect(chunk, rect);
      }
    }
  }
}

export function tileCorner(
  tile: TileCoord
): { x: number; z: number; } {
  const origin = tile.chunk.originSample;
  const { x, z } = tile.area;

  return {
    x: origin.x + x,
    z: origin.z + z
  };
}

export function clampHeight(
  height: number
): number {
  return Math.min(Math.max(height, HEIGHT_RANGE.min), HEIGHT_RANGE.max);
}

function* chunkTilesInRect(
  chunk: TerrainChunk,
  { minX, minZ, maxX, maxZ }: GroundRect
): IterableIterator<TileCoord> {
  const side = tilesPerSide(chunk.tier);
  const size = CHUNK_SAMPLES / side;
  const origin = chunk.coord.originSample;
  function tileRange(
    min: number,
    max: number,
    start: number
  ): [number, number] {
    return [
      Math.max(0, Math.floor((min - start) / size)),
      Math.min(side - 1, Math.floor((max - start) / size))
    ];
  }
  const [firstX, lastX] = tileRange(minX, maxX, origin.x);
  const [firstZ, lastZ] = tileRange(minZ, maxZ, origin.z);
  for (let tileZ = firstZ; tileZ <= lastZ; tileZ++) {
    for (let tileX = firstX; tileX <= lastX; tileX++) {
      yield new TileCoord(chunk.coord, tileX, tileZ, chunk.tier);
    }
  }
}
