// Import Internal Dependencies
import type { TerrainCommand } from "./types.ts";

export function terrainChunkKey(
  x: number,
  z: number
): string {
  return `chunk:${x},${z}`;
}

export function terrainWriteKeys(
  command: TerrainCommand
): string[] {
  return [terrainChunkKey(command.x, command.z)];
}
