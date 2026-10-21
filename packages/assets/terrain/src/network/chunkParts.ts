// Import Third-party Dependencies
import {
  ChunkCoord,
  type ChunkKey
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import type { TerrainCommand } from "./types.ts";

// CONSTANTS
const kPartIdPattern = /^(-?\d+)_(-?\d+)$/;

export function chunkPartId(
  coord: ChunkCoord
): string {
  return `${coord.x}_${coord.z}`;
}

export function chunkOfPart(
  partId: string
): ChunkCoord | null {
  const match = kPartIdPattern.exec(partId);

  return match === null ?
    null :
    new ChunkCoord(Number(match[1]), Number(match[2]));
}

export function touchedChunks(
  command: TerrainCommand
): ChunkCoord[] {
  if (command.action !== "heights-patched") {
    return [new ChunkCoord(command.x, command.z)];
  }

  const chunks = new Map<ChunkKey, ChunkCoord>();
  for (const { x, z } of command.tiles) {
    const coord = new ChunkCoord(x, z);
    chunks.set(coord.key, coord);
  }

  return [...chunks.values()];
}
