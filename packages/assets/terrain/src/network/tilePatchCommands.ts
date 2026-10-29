// Import Third-party Dependencies
import {
  ChunkCoord,
  TileCoord,
  type TerrainReader
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  currentHoleTilePatches,
  decodeHoleTilePatch
} from "./holes.ts";
import {
  currentSplatTilePatches,
  decodeSplatTilePatch
} from "./splat.ts";
import {
  currentTilePatches,
  decodeTilePatch
} from "./tilePatches.ts";
import type { TerrainCommand } from "./types.ts";

// CONSTANTS
export const CHUNK_CHANNELS = ["heights", "splat", "holes"] as const;
const kChannels = {
  "heights-patched": "heights",
  "splat-patched": "splat",
  "holes-patched": "holes"
} as const satisfies Record<TilePatchAction, ChunkChannel>;

export type ChunkChannel = typeof CHUNK_CHANNELS[number];
export type TilePatchAction = "heights-patched" | "splat-patched" | "holes-patched";
export type TilePatchCommand = Extract<TerrainCommand, { action: TilePatchAction; }>;

export interface PatchTile {
  readonly x: number;
  readonly z: number;
  readonly tile: number;
}

export function isTilePatchCommand<TCommand extends TerrainCommand>(
  command: TCommand
): command is Extract<TCommand, { action: TilePatchAction; }> {
  return command.action in kChannels;
}

export function tileChannel(
  command: TilePatchCommand
): ChunkChannel {
  return kChannels[command.action];
}

export function patchedTiles(
  command: TilePatchCommand
): TileCoord[] {
  return command.tiles.map(({ x, z, tile }) => TileCoord.fromIndex(new ChunkCoord(x, z), tile));
}

export function filterTiles<TCommand extends TilePatchCommand>(
  command: TCommand,
  keep: (tile: PatchTile) => boolean
): TCommand {
  return { ...command, tiles: command.tiles.filter(keep) };
}

export function decodableTiles(
  command: TilePatchCommand
): Set<PatchTile> {
  switch (command.action) {
    case "heights-patched":
      return new Set(command.tiles.filter((tile) => decodeTilePatch(tile) !== null));
    case "splat-patched":
      return new Set(command.tiles.filter((tile) => decodeSplatTilePatch(tile) !== null));
    case "holes-patched":
      return new Set(command.tiles.filter((tile) => decodeHoleTilePatch(tile) !== null));
  }
}

export function currentTiles(
  terrain: TerrainReader,
  command: TilePatchCommand
): TilePatchCommand {
  switch (command.action) {
    case "heights-patched":
      return { action: command.action, tiles: currentTilePatches(terrain, command.tiles) };
    case "splat-patched":
      return { action: command.action, tiles: currentSplatTilePatches(terrain, command.tiles) };
    case "holes-patched":
      return { action: command.action, tiles: currentHoleTilePatches(terrain, command.tiles) };
  }
}
