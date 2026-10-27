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
const kPartIdPattern = /^(-?\d+)_(-?\d+)(_splat)?$/;
const kSplatSuffix = "_splat";
const kOverviewTiles = new Set(
  Array.from({ length: CHUNK_TILE_COUNT }, (_, index) => index)
    .filter((index) => isOverviewTile(TileCoord.fromIndex(new ChunkCoord(0, 0), index)))
);

export type ChunkPartKind = "heights" | "splat";

export interface ChunkPart {
  readonly coord: ChunkCoord;
  readonly kind: ChunkPartKind;
}

export function chunkPartId(
  coord: ChunkCoord,
  kind: ChunkPartKind = "heights"
): string {
  const base = `${coord.x}_${coord.z}`;

  return kind === "splat" ? `${base}${kSplatSuffix}` : base;
}

export function chunkPartIds(
  coord: ChunkCoord
): string[] {
  return [chunkPartId(coord, "heights"), chunkPartId(coord, "splat")];
}

export function parseChunkPart(
  partId: string
): ChunkPart | null {
  const match = kPartIdPattern.exec(partId);

  return match === null ?
    null :
    {
      coord: new ChunkCoord(Number(match[1]), Number(match[2])),
      kind: match[3] === undefined ? "heights" : "splat"
    };
}

export function touchedChunks(
  command: TerrainCommand
): ChunkCoord[] {
  if (isMaterialCommand(command)) {
    return [];
  }
  if (command.action === "chunk-added" || command.action === "chunk-removed") {
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
  switch (command.action) {
    case "heights-patched":
      return chunks.map((coord) => chunkPartId(coord, "heights"));
    case "splat-patched":
      return chunks.map((coord) => chunkPartId(coord, "splat"));
    default:
      return chunks.flatMap(chunkPartIds);
  }
}

export function outsideCommand<TCommand extends TerrainCommand>(
  command: TCommand
): TCommand | null {
  if (command.action !== "heights-patched" && command.action !== "splat-patched") {
    return command;
  }

  const tiles = command.tiles.filter(({ tile }) => kOverviewTiles.has(tile));

  return tiles.length === 0 ? null : { ...command, tiles };
}
