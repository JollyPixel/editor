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
import {
  CHUNK_CHANNELS,
  filterTiles,
  isTilePatchCommand,
  tileChannel,
  type ChunkChannel
} from "./tilePatchCommands.ts";
import type { TerrainCommand } from "./types.ts";

// CONSTANTS
const kPartIdPattern = /^(-?\d+)_(-?\d+)(_splat)?$/;
const kPartSuffixes: Readonly<Record<ChunkChannel, string>> = {
  heights: "",
  splat: "_splat"
};
const kOverviewTiles = new Set(
  Array.from({ length: CHUNK_TILE_COUNT }, (_, index) => index)
    .filter((index) => isOverviewTile(TileCoord.fromIndex(new ChunkCoord(0, 0), index)))
);

export interface ChunkPart {
  readonly coord: ChunkCoord;
  readonly channel: ChunkChannel;
}

export function chunkPartId(
  coord: ChunkCoord,
  channel: ChunkChannel
): string {
  return `${coord.x}_${coord.z}${kPartSuffixes[channel]}`;
}

export function chunkPartIds(
  coord: ChunkCoord
): string[] {
  return CHUNK_CHANNELS.map((channel) => chunkPartId(coord, channel));
}

export function parseChunkPart(
  partId: string
): ChunkPart | null {
  const match = kPartIdPattern.exec(partId);

  return match === null ?
    null :
    {
      coord: new ChunkCoord(Number(match[1]), Number(match[2])),
      channel: match[3] === undefined ? "heights" : "splat"
    };
}

export function touchedChunks(
  command: TerrainCommand
): ChunkCoord[] {
  if (isMaterialCommand(command)) {
    return [];
  }
  if (!isTilePatchCommand(command)) {
    return [new ChunkCoord(command.x, command.z)];
  }

  const chunks = new Map<ChunkKey, ChunkCoord>();
  for (const { x, z } of command.tiles) {
    const coord = new ChunkCoord(x, z);
    chunks.set(coord.key, coord);
  }

  return [...chunks.values()];
}

export function touchedParts(
  command: TerrainCommand
): string[] {
  const chunks = touchedChunks(command);
  if (!isTilePatchCommand(command)) {
    return chunks.flatMap(chunkPartIds);
  }

  const channel = tileChannel(command);

  return chunks.map((coord) => chunkPartId(coord, channel));
}

export function outsideCommand<TCommand extends TerrainCommand>(
  command: TCommand
): TCommand | null {
  if (!isTilePatchCommand(command)) {
    return command;
  }

  const outside = filterTiles(command, ({ tile }) => kOverviewTiles.has(tile));

  return outside.tiles.length === 0 ? null : outside;
}
