// Import Third-party Dependencies
import {
  CHUNK_SAMPLE_COUNT,
  ChunkCoord,
  OVERVIEW_SAMPLE_COUNT,
  type Terrain,
  type TerrainReader,
  type TilePatch
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  decodeHeights,
  encodeHeights
} from "../network/heights.ts";
import { decodeTilePatch } from "../network/tilePatches.ts";
import { chunkOverview } from "./chunkOverview.ts";
import type {
  EncodedTilePatch,
  TerrainCommand,
  TerrainManifest,
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
      return !terrain.knows(edit.coord) &&
        terrain.overview.size < MAX_TERRAIN_CHUNKS &&
        (terrain.overview.size === 0 || terrain.touches(edit.coord));
    case "chunk-removed":
      return terrain.knows(edit.coord) && terrain.overview.size > 1;
    case "heights-patched":
      return edit.patches.every(({ tile }) => terrain.knows(tile.chunk));
  }
}

export function applyTerrainCommand(
  terrain: Terrain,
  command: TerrainCommand,
  loads: (coord: ChunkCoord) => boolean = () => true
): void {
  const edit = terrainEdit(command);
  if (edit === null) {
    throw new RangeError(`Terrain command "${command.action}" has invalid heights.`);
  }

  switch (edit.action) {
    case "chunk-added":
      if (loads(edit.coord)) {
        terrain.addChunk(edit.coord, edit.heights);
      }
      else {
        terrain.addUnloadedChunk(edit.coord, chunkOverview(edit.heights));
      }
      break;
    case "chunk-removed":
      terrain.removeChunk(edit.coord);
      break;
    case "heights-patched":
      for (const { tile, heights } of edit.patches) {
        if (terrain.has(tile.chunk)) {
          terrain.writeTile(tile, heights);
        }
        else {
          terrain.writeOverviewTile(tile, heights);
        }
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
    chunks: Array.from(terrain.overview.coords(), (coord) => {
      const chunk = terrain.chunk(coord);

      return chunk === undefined ?
        { x: coord.x, z: coord.z, overview: encodeHeights(terrain.overview.samples(coord)!) } :
        { x: coord.x, z: coord.z, heights: encodeHeights(chunk.copyHeights()) };
    })
  };
}

export function terrainManifest(
  terrain: TerrainReader
): TerrainManifest {
  return {
    chunks: Array.from(terrain.overview.coords(), (coord) => {
      return {
        x: coord.x,
        z: coord.z,
        overview: encodeHeights(terrain.overview.samples(coord)!)
      };
    })
  };
}

export function loadTerrainManifest(
  terrain: Terrain,
  manifest: TerrainManifest
): void {
  const chunks = manifest.chunks.map((chunk) => {
    const heights = chunk.heights === undefined ?
      new Float32Array(CHUNK_SAMPLE_COUNT) :
      decodeHeights(chunk.heights);
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

export function loadChunkHeights(
  terrain: Terrain,
  coord: ChunkCoord,
  heights: Float32Array
): void {
  if (terrain.removeChunk(coord) !== undefined) {
    terrain.addChunk(coord, heights);
  }
}

export function loadTerrainSnapshot(
  terrain: Terrain,
  snapshot: TerrainSnapshot
): void {
  const chunks = snapshot.chunks.map((chunk) => {
    const coord = new ChunkCoord(chunk.x, chunk.z);
    if (chunk.heights !== undefined) {
      return { coord, heights: decodedOrThrow(chunk.heights, CHUNK_SAMPLE_COUNT, coord) };
    }

    return {
      coord,
      overview: chunk.overview === undefined ?
        new Float32Array(OVERVIEW_SAMPLE_COUNT) :
        decodedOrThrow(chunk.overview, OVERVIEW_SAMPLE_COUNT, coord)
    };
  });

  terrain.clear();
  for (const chunk of chunks) {
    if ("heights" in chunk) {
      terrain.addChunk(chunk.coord, chunk.heights);
    }
    else {
      terrain.addUnloadedChunk(chunk.coord, chunk.overview);
    }
  }
}

function decodedOrThrow(
  encoded: string,
  length: number,
  coord: ChunkCoord
): Float32Array {
  const decoded = decodeHeights(encoded, length);
  if (decoded === null) {
    throw new RangeError(`Chunk ${coord.key} has invalid heights.`);
  }

  return decoded;
}
