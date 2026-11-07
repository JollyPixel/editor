// Import Third-party Dependencies
import { InvalidEntryError } from "@jolly-pixel/asset.common";
import { ChunkCoord } from "@jolly-pixel/terrain.renderer";
import {
  decodeBase64,
  encodeBase64
} from "@jolly-pixel/utils";

// Import Internal Dependencies
import {
  TERRAIN_FILE_VERSION,
  type TerrainFile
} from "./terrain.ts";
import type {
  ChunkEntry,
  TerrainManifest
} from "../network/types.ts";

type ChunkFileEntry = TerrainFile["chunks"][number];

export function terrainFile(
  manifest: TerrainManifest
): TerrainFile {
  return {
    version: TERRAIN_FILE_VERSION,
    ...manifest,
    chunks: manifest.chunks.map(fileChunkEntry)
  };
}

export function terrainFileManifest(
  { version: _version, ...file }: TerrainFile
): TerrainManifest {
  return {
    ...file,
    chunks: file.chunks.map(manifestChunkEntry)
  };
}

function fileChunkEntry(
  { overview, materials, heights, splat, holes, ...entry }: ChunkEntry
): ChunkFileEntry {
  return {
    ...entry,
    ...(overview === undefined ? {} : { overview: encodeBase64(overview) }),
    ...(materials === undefined ? {} : { materials: encodeBase64(materials) }),
    ...(heights === undefined ? {} : { heights: encodeBase64(heights) }),
    ...(splat === undefined ? {} : { splat: encodeBase64(splat) }),
    ...(holes === undefined ? {} : { holes: encodeBase64(holes) })
  };
}

function manifestChunkEntry(
  { overview, materials, heights, splat, holes, ...entry }: ChunkFileEntry
): ChunkEntry {
  const coord = new ChunkCoord(entry.x, entry.z);

  return {
    ...entry,
    ...(overview === undefined ? {} : { overview: bytesOrThrow(overview, coord) }),
    ...(materials === undefined ? {} : { materials: bytesOrThrow(materials, coord) }),
    ...(heights === undefined ? {} : { heights: bytesOrThrow(heights, coord) }),
    ...(splat === undefined ? {} : { splat: bytesOrThrow(splat, coord) }),
    ...(holes === undefined ? {} : { holes: bytesOrThrow(holes, coord) })
  };
}

function bytesOrThrow(
  encoded: string,
  coord: ChunkCoord
): Uint8Array {
  const bytes = decodeBase64(encoded);
  if (bytes === null) {
    throw new InvalidEntryError("chunk", coord.key, "holds invalid base64");
  }

  return bytes;
}
