// Import Third-party Dependencies
import {
  ChunkCoord,
  isOverviewTile,
  TileCoord,
  type ChunkKey
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import { isMaterialCommand } from "../model/materialCommands.ts";
import { CHUNK_TILE_COUNT } from "./TerrainCommand.schema.ts";
import type { TerrainCommand } from "./types.ts";

// CONSTANTS
const kPartIdPattern = /^(-?\d+)_(-?\d+)$/;
const kOverviewTiles = new Set(
  Array.from({ length: CHUNK_TILE_COUNT }, (_, index) => index)
    .filter((index) => isOverviewTile(TileCoord.fromIndex(new ChunkCoord(0, 0), index)))
);

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
  if (isMaterialCommand(command)) {
    return [];
  }
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

export function outsideCommand<TCommand extends TerrainCommand>(
  command: TCommand
): TCommand | null {
  if (command.action !== "heights-patched") {
    return command;
  }

  const tiles = command.tiles.filter(({ tile }) => kOverviewTiles.has(tile));

  return tiles.length === 0 ? null : { ...command, tiles };
}
