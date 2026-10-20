// Import Third-party Dependencies
import {
  ChunkCoord,
  type TerrainDocument,
  type TerrainReader,
  type TilePatch
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

type TerrainEdit =
  | {
    readonly action: "chunk-added";
    readonly coord: ChunkCoord;
    readonly heights: Float32Array;
  }
  | {
    readonly action: "chunk-removed";
    readonly coord: ChunkCoord;
  }
  | {
    readonly action: "heights-patched";
    readonly patches: readonly TilePatch[];
  };

export function acceptsTerrainCommand(
  terrain: TerrainReader,
  command: TerrainCommand
): boolean {
  const edit = terrainEdit(command);
  if (edit === null) {
    return false;
  }

  switch (edit.action) {
    case "chunk-added":
      return !terrain.has(edit.coord) &&
        terrain.size < MAX_TERRAIN_CHUNKS &&
        (terrain.size === 0 || terrain.touches(edit.coord));
    case "chunk-removed":
      return terrain.has(edit.coord) && terrain.size > 1;
    case "heights-patched":
      return edit.patches.every(({ tile }) => terrain.has(tile.chunk));
  }
}

export function applyTerrainCommand(
  terrain: TerrainDocument,
  command: TerrainCommand
): void {
  const edit = terrainEdit(command);
  if (edit === null) {
    throw new RangeError(`Terrain command "${command.action}" has invalid heights.`);
  }

  switch (edit.action) {
    case "chunk-added":
      terrain.addChunk(edit.coord, edit.heights);
      break;
    case "chunk-removed":
      terrain.removeChunk(edit.coord);
      break;
    case "heights-patched":
      for (const { tile, heights } of edit.patches) {
        terrain.writeTile(tile, heights);
      }
      break;
  }
}

function terrainEdit(
  command: TerrainCommand
): TerrainEdit | null {
  if (command.action === "heights-patched") {
    return decodeTilePatches(command.tiles);
  }

  const coord = new ChunkCoord(command.x, command.z);
  if (command.action === "chunk-removed") {
    return { action: "chunk-removed", coord };
  }

  const heights = decodeHeights(command.heights);

  return heights === null ? null : { action: "chunk-added", coord, heights };
}

function decodeTilePatches(
  tiles: readonly EncodedTilePatch[]
): TerrainEdit | null {
  const patches: TilePatch[] = [];
  const keys = new Set<string>();
  for (const encoded of tiles) {
    const patch = decodeTilePatch(encoded);
    if (patch === null || keys.has(patch.tile.key)) {
      return null;
    }
    keys.add(patch.tile.key);
    patches.push(patch);
  }

  return { action: "heights-patched", patches };
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
