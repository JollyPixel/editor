// Import Third-party Dependencies
import {
  ChunkCoord,
  type TerrainDocument,
  type TerrainReader
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  decodeHeights,
  encodeHeights
} from "../network/heights.ts";
import { decodeTilePatch } from "../network/tilePatches.ts";
import type {
  EncodedTilePatch,
  TerrainCommand,
  TerrainSnapshot
} from "../network/types.ts";

// CONSTANTS
export const MAX_TERRAIN_CHUNKS = 256;

export function acceptsTerrainCommand(
  terrain: TerrainReader,
  command: TerrainCommand
): boolean {
  if (command.action === "heights-patched") {
    return acceptsTiles(terrain, command.tiles);
  }

  const coord = new ChunkCoord(command.x, command.z);
  switch (command.action) {
    case "chunk-added":
      return !terrain.has(coord) &&
        terrain.size < MAX_TERRAIN_CHUNKS &&
        (terrain.size === 0 || terrain.touches(coord)) &&
        decodeHeights(command.heights) !== null;
    case "chunk-removed":
      return terrain.has(coord) && terrain.size > 1;
  }
}

export function applyTerrainCommand(
  terrain: TerrainDocument,
  command: TerrainCommand
): void {
  if (command.action === "heights-patched") {
    for (const encoded of command.tiles) {
      const { tile, heights } = decodeTilePatch(encoded)!;
      terrain.writeTile(tile, heights);
    }

    return;
  }

  const coord = new ChunkCoord(command.x, command.z);
  switch (command.action) {
    case "chunk-added":
      terrain.addChunk(coord, decodeHeights(command.heights)!);
      break;
    case "chunk-removed":
      terrain.removeChunk(coord);
      break;
  }
}

function acceptsTiles(
  terrain: TerrainReader,
  tiles: readonly EncodedTilePatch[]
): boolean {
  const keys = new Set<string>();
  for (const encoded of tiles) {
    const patch = decodeTilePatch(encoded);
    if (patch === null || !terrain.has(patch.tile.chunk) || keys.has(patch.tile.key)) {
      return false;
    }
    keys.add(patch.tile.key);
  }

  return true;
}

export function terrainSnapshot(
  terrain: TerrainReader
): TerrainSnapshot {
  return {
    chunks: Array.from(terrain.chunks(), (chunk) => {
      return {
        x: chunk.coord.x,
        z: chunk.coord.z,
        heights: encodeHeights(chunk.copyHeights())
      };
    })
  };
}

export function loadTerrainSnapshot(
  terrain: TerrainDocument,
  snapshot: TerrainSnapshot
): void {
  const chunks = snapshot.chunks.map((chunk) => {
    const heights = decodeHeights(chunk.heights);
    if (heights === null) {
      throw new RangeError(`Chunk ${chunk.x},${chunk.z} has invalid heights.`);
    }

    return {
      coord: new ChunkCoord(chunk.x, chunk.z),
      heights
    };
  });

  terrain.clear();
  for (const { coord, heights } of chunks) {
    terrain.addChunk(coord, heights);
  }
}
