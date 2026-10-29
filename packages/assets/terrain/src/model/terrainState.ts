// Import Third-party Dependencies
import {
  CHUNK_SAMPLE_COUNT,
  ChunkCoord,
  DEFAULT_MATERIAL_TEXTURE_SIZE,
  OVERVIEW_SAMPLE_COUNT,
  SplatMap,
  type SplatTexels,
  type TerrainChunk,
  type TerrainReader,
  type TileCoord,
  type TilePatch
} from "@jolly-pixel/terrain.renderer";
import { InvalidEntryError } from "@jolly-pixel/asset.common";

// Import Internal Dependencies
import {
  decodeHeights,
  encodeHeights
} from "../network/heights.ts";
import {
  decodeHoles,
  decodeHoleTilePatch,
  encodeHoles,
  type HoleTilePatch
} from "../network/holes.ts";
import {
  decodeMaterials,
  decodeSplat,
  decodeSplatTilePatch,
  encodeMaterials,
  encodeSplat,
  type SplatTilePatch
} from "../network/splat.ts";
import { decodeTilePatch } from "../network/tilePatches.ts";
import { chunkOverview } from "./chunkOverview.ts";
import {
  acceptsMaterialCommand,
  applyMaterialCommand,
  isMaterialCommand
} from "./materialCommands.ts";
import {
  GROUND_MATERIAL,
  TerrainMaterials
} from "./TerrainMaterials.ts";
import type {
  TerrainModel,
  TerrainModelReader
} from "./TerrainModel.ts";
import type {
  ChunkEntry,
  TerrainChunkCommand,
  TerrainCommand,
  TerrainManifest,
  TerrainSnapshot
} from "../network/types.ts";

// CONSTANTS
export const MAX_TERRAIN_CHUNKS = 4096;

export interface LoadedChunkEntry {
  readonly x: number;
  readonly z: number;
  readonly heights: string;
  readonly splat: string;
  readonly holes?: string;
}

type TerrainEdit =
  | {
    readonly action: "chunk-added";
    readonly coord: ChunkCoord;
    readonly heights: Float32Array;
    readonly splat: SplatTexels | undefined;
    readonly holes: Uint8Array | undefined;
  }
  | {
    readonly action: "chunk-removed";
    readonly coord: ChunkCoord;
  }
  | {
    readonly action: "heights-patched";
    readonly patches: readonly TilePatch[];
  }
  | {
    readonly action: "splat-patched";
    readonly patches: readonly SplatTilePatch[];
  }
  | {
    readonly action: "holes-patched";
    readonly patches: readonly HoleTilePatch[];
  };

export function acceptsTerrainCommand(
  model: TerrainModelReader,
  command: TerrainCommand
): boolean {
  if (isMaterialCommand(command)) {
    return acceptsMaterialCommand(model.materials, command);
  }

  const { terrain } = model;
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
    case "splat-patched":
    case "holes-patched":
      return edit.patches.every(({ tile }) => terrain.knows(tile.chunk));
  }
}

export function applyTerrainCommand(
  model: TerrainModel,
  command: TerrainCommand,
  loads: (coord: ChunkCoord) => boolean = () => true
): void {
  if (isMaterialCommand(command)) {
    applyMaterialCommand(model.materials, command);

    return;
  }

  const { terrain } = model;
  const edit = terrainEdit(command);
  if (edit === null) {
    throw new RangeError(`Terrain command "${command.action}" has invalid data.`);
  }

  switch (edit.action) {
    case "chunk-added":
      if (loads(edit.coord)) {
        terrain.addChunk(edit.coord, edit.heights, edit.splat, edit.holes);
      }
      else {
        terrain.addUnloadedChunk(
          edit.coord,
          chunkOverview(edit.heights),
          edit.splat === undefined ? undefined : new SplatMap(edit.splat).overviewMaterials()
        );
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
    case "splat-patched":
      for (const { tile, splat } of edit.patches) {
        if (terrain.has(tile.chunk)) {
          terrain.writeSplatTile(tile, splat);
        }
        else {
          terrain.writeOverviewSplatTile(tile, splat);
        }
      }
      break;
    case "holes-patched":
      for (const { tile, holes } of edit.patches) {
        if (terrain.has(tile.chunk)) {
          terrain.writeHoleTile(tile, holes);
        }
      }
      break;
  }
}

function terrainEdit(
  command: TerrainChunkCommand
): TerrainEdit | null {
  if (command.action === "heights-patched") {
    const patches = uniquePatches(command.tiles, decodeTilePatch);

    return patches === null ? null : { action: command.action, patches };
  }
  if (command.action === "splat-patched") {
    const patches = uniquePatches(command.tiles, decodeSplatTilePatch);

    return patches === null ? null : { action: command.action, patches };
  }
  if (command.action === "holes-patched") {
    const patches = uniquePatches(command.tiles, decodeHoleTilePatch);

    return patches === null ? null : { action: command.action, patches };
  }

  const coord = new ChunkCoord(command.x, command.z);
  if (command.action === "chunk-removed") {
    return { action: "chunk-removed", coord };
  }

  const heights = decodeHeights(command.heights);
  const splat = command.splat === undefined ? undefined : decodeSplat(command.splat);
  const holes = command.holes === undefined ? undefined : decodeHoles(command.holes);
  if (heights === null || splat === null || holes === null) {
    return null;
  }

  return { action: "chunk-added", coord, heights, splat, holes };
}

function uniquePatches<TEncoded, TPatch extends { readonly tile: TileCoord; }>(
  tiles: readonly TEncoded[],
  decode: (encoded: TEncoded) => TPatch | null
): TPatch[] | null {
  const patches: TPatch[] = [];
  const keys = new Set<string>();
  for (const encoded of tiles) {
    const patch = decode(encoded);
    if (patch === null || keys.has(patch.tile.key)) {
      return null;
    }
    keys.add(patch.tile.key);
    patches.push(patch);
  }

  return patches;
}

export function terrainSnapshot(
  { terrain, materials }: TerrainModelReader
): TerrainSnapshot {
  return {
    chunks: Array.from(terrain.overview.coords(), (coord) => {
      const chunk = terrain.chunk(coord);

      return chunk === undefined ? overviewEntry(terrain, coord) : loadedChunkEntry(chunk);
    }),
    materials: materials.materials(),
    textureSize: materials.textureSize
  };
}

export function terrainManifest(
  { terrain, materials }: TerrainModelReader
): TerrainManifest {
  return {
    chunks: Array.from(terrain.overview.coords(), (coord) => overviewEntry(terrain, coord)),
    materials: materials.materials(),
    textureSize: materials.textureSize
  };
}

export function loadTerrainManifest(
  model: TerrainModel,
  manifest: TerrainManifest
): void {
  const { terrain } = model;
  const listed = new Set<string>();
  const chunks = manifest.chunks.map((chunk) => {
    const coord = new ChunkCoord(chunk.x, chunk.z);
    if (listed.has(coord.key)) {
      throw new InvalidEntryError("chunk", coord.key, "is listed twice");
    }
    listed.add(coord.key);

    return {
      coord,
      heights: chunk.heights === undefined ?
        new Float32Array(CHUNK_SAMPLE_COUNT) :
        decodedOrThrow(chunk.heights, CHUNK_SAMPLE_COUNT, coord),
      splat: chunk.splat === undefined ? undefined : splatOrThrow(chunk.splat, coord)
    };
  });

  const materials = loadedMaterials(manifest);
  terrain.clear();
  for (const { coord, heights, splat } of chunks) {
    terrain.addChunk(coord, heights, splat);
  }
  model.materials.load(materials.materials(), materials.textureSize);
}

export function loadTerrainSnapshot(
  model: TerrainModel,
  snapshot: TerrainSnapshot
): void {
  const { terrain } = model;
  const chunks = snapshot.chunks.map((chunk) => {
    const coord = new ChunkCoord(chunk.x, chunk.z);
    const materials = chunk.materials === undefined ?
      undefined :
      materialsOrThrow(chunk.materials, coord);
    if (chunk.heights !== undefined) {
      return {
        coord,
        materials,
        heights: decodedOrThrow(chunk.heights, CHUNK_SAMPLE_COUNT, coord),
        splat: chunk.splat === undefined ? undefined : splatOrThrow(chunk.splat, coord),
        holes: chunk.holes === undefined ? undefined : holesOrThrow(chunk.holes, coord)
      };
    }

    return {
      coord,
      materials,
      overview: chunk.overview === undefined ?
        new Float32Array(OVERVIEW_SAMPLE_COUNT) :
        decodedOrThrow(chunk.overview, OVERVIEW_SAMPLE_COUNT, coord)
    };
  });

  const materials = loadedMaterials(snapshot);
  terrain.clear();
  for (const chunk of chunks) {
    if ("heights" in chunk) {
      terrain.addChunk(chunk.coord, chunk.heights, chunk.splat, chunk.holes);
      if (chunk.splat === undefined && chunk.materials !== undefined) {
        terrain.overview.writeMaterials(chunk.coord, chunk.materials);
      }
    }
    else {
      terrain.addUnloadedChunk(chunk.coord, chunk.overview, chunk.materials);
    }
  }
  model.materials.load(materials.materials(), materials.textureSize);
}

export function loadedChunkEntry(
  chunk: TerrainChunk
): LoadedChunkEntry {
  return {
    x: chunk.coord.x,
    z: chunk.coord.z,
    heights: encodeHeights(chunk.copyHeights()),
    splat: encodeSplat(chunk.splat.copy()),
    ...(chunk.holes.empty ? {} : { holes: encodeHoles(chunk.holes.copy()) })
  };
}

function overviewEntry(
  terrain: TerrainReader,
  coord: ChunkCoord
): ChunkEntry {
  const holes = terrain.chunk(coord)?.holes;

  return {
    x: coord.x,
    z: coord.z,
    overview: encodeHeights(terrain.overview.samples(coord)!),
    materials: encodeMaterials(terrain.overview.materials(coord)!),
    ...(holes === undefined || holes.empty ? {} : { hasHoles: true })
  };
}

function holesOrThrow(
  encoded: string,
  coord: ChunkCoord
): Uint8Array {
  const holes = decodeHoles(encoded);
  if (holes === null) {
    throw new InvalidEntryError("chunk", coord.key, "has an invalid hole mask");
  }

  return holes;
}

function splatOrThrow(
  encoded: string,
  coord: ChunkCoord
): SplatTexels {
  const splat = decodeSplat(encoded);
  if (splat === null) {
    throw new InvalidEntryError("chunk", coord.key, "has an invalid splat map");
  }

  return splat;
}

function materialsOrThrow(
  encoded: string,
  coord: ChunkCoord
): Uint8Array {
  const materials = decodeMaterials(encoded);
  if (materials === null) {
    throw new InvalidEntryError("chunk", coord.key, "has invalid overview materials");
  }

  return materials;
}

function loadedMaterials(
  { materials = [GROUND_MATERIAL], textureSize = DEFAULT_MATERIAL_TEXTURE_SIZE }: TerrainManifest
): TerrainMaterials {
  const loaded = new TerrainMaterials();
  loaded.load(materials, textureSize);

  return loaded;
}

function decodedOrThrow(
  encoded: string,
  length: number,
  coord: ChunkCoord
): Float32Array {
  const decoded = decodeHeights(encoded, length);
  if (decoded === null) {
    throw new InvalidEntryError("chunk", coord.key, "has invalid heights");
  }

  return decoded;
}
