// Import Third-party Dependencies
import { TILES_PER_CHUNK } from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import type { TerrainCommand } from "./types.ts";

// CONSTANTS
const kTilesPerChunk = TILES_PER_CHUNK * TILES_PER_CHUNK;

export function terrainChunkKey(
  x: number,
  z: number
): string {
  return `chunk:${x},${z}`;
}

export function terrainHeightTileKey(
  x: number,
  z: number,
  tile: number
): string {
  return `${terrainChunkKey(x, z)}:h:${tile}`;
}

export function terrainWriteKeys(
  command: TerrainCommand
): string[] {
  if (command.action === "heights-patched") {
    return command.tiles.map(({ x, z, tile }) => terrainHeightTileKey(x, z, tile));
  }

  return [
    terrainChunkKey(command.x, command.z),
    ...Array.from({ length: kTilesPerChunk }, (_, tile) => terrainHeightTileKey(command.x, command.z, tile))
  ];
}
