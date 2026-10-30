// Import Third-party Dependencies
import {
  ChunkCoord,
  isOverviewTile,
  type ChunkKey
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import { isMaterialCommand } from "../model/materialCommands.ts";
import { isPoiCommand } from "../model/poiCommands.ts";
import { patchTileCoord } from "./patchTile.ts";
import {
  CHUNK_CHANNELS,
  filterTiles,
  isTilePatchCommand,
  tileChannel,
  type ChunkChannel
} from "./tilePatchCommands.ts";
import type {
  ChunkEntry,
  TerrainCommand
} from "./types.ts";

// CONSTANTS
const kPartIdPattern = /^(-?\d+)_(-?\d+)(?:_(splat|holes))?$/;
const kPartSuffixes: Readonly<Record<ChunkChannel, string>> = {
  heights: "",
  splat: "_splat",
  holes: "_holes"
};

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
      channel: CHUNK_CHANNELS.find((channel) => channel === match[3]) ?? "heights"
    };
}

export function listedChunkPartIds(
  { x, z, hasHoles }: ChunkEntry
): string[] {
  const coord = new ChunkCoord(x, z);

  return CHUNK_CHANNELS
    .filter((channel) => channel !== "holes" || hasHoles === true)
    .map((channel) => chunkPartId(coord, channel));
}

export function touchedChunks(
  command: TerrainCommand
): ChunkCoord[] {
  if (isMaterialCommand(command) || isPoiCommand(command)) {
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
  if (command.action === "tier-changed") {
    return chunks.flatMap((coord) => [chunkPartId(coord, "heights"), chunkPartId(coord, "holes")]);
  }
  if (!isTilePatchCommand(command)) {
    return chunks.flatMap(chunkPartIds);
  }

  const channel = tileChannel(command);

  return chunks.map((coord) => chunkPartId(coord, channel));
}

export function outsideCommand<TCommand extends TerrainCommand>(
  command: TCommand
): TCommand | null {
  if (command.action === "tier-changed") {
    return null;
  }
  if (!isTilePatchCommand(command)) {
    return command;
  }
  if (command.action === "holes-patched") {
    return null;
  }

  const outside = filterTiles(command, (tile) => {
    const coord = patchTileCoord(tile);

    return coord !== null && isOverviewTile(coord);
  });

  return outside.tiles.length === 0 ? null : outside;
}
