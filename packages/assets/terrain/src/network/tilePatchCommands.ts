// Import Third-party Dependencies
import {
  ChunkCoord,
  type TerrainReader,
  type TileCoord
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  chunkAtTier,
  patchTileCoord,
  type PatchTile
} from "./patchTile.ts";
import {
  decodeHoleTilePatch,
  encodeHoleTilePatch
} from "./holes.ts";
import {
  decodeSplatTilePatch,
  encodeSplatTilePatch
} from "./splat.ts";
import {
  decodeTilePatch,
  encodeTilePatch
} from "./tilePatches.ts";
import type { TerrainCommand } from "./types.ts";

// CONSTANTS
export const CHUNK_CHANNELS = ["heights", "splat", "holes"] as const;
const kTileChannels: { readonly [TAction in TilePatchAction]: TileChannel<EncodedTile<TAction>>; } = {
  "heights-patched": {
    channel: "heights",
    decode: decodeTilePatch,
    current: (terrain, tile) => {
      const heights = chunkAtTier(terrain, tile)?.tileHeights(tile.x, tile.z);

      return heights === undefined ? undefined : encodeTilePatch({ tile, heights });
    }
  },
  "splat-patched": {
    channel: "splat",
    decode: decodeSplatTilePatch,
    current: (terrain, tile) => {
      const splat = terrain.chunk(tile.chunk)?.splat.tile(tile.x, tile.z);

      return splat === undefined ? undefined : encodeSplatTilePatch({ tile, splat });
    }
  },
  "holes-patched": {
    channel: "holes",
    decode: decodeHoleTilePatch,
    current: (terrain, tile) => {
      const holes = chunkAtTier(terrain, tile)?.holes.tile(tile.x, tile.z);

      return holes === undefined ? undefined : encodeHoleTilePatch({ tile, holes });
    }
  }
};

export type ChunkChannel = typeof CHUNK_CHANNELS[number];
export type TilePatchAction = "heights-patched" | "splat-patched" | "holes-patched";
export type TilePatchCommand = Extract<TerrainCommand, { action: TilePatchAction; }>;
export type EncodedTile<TAction extends TilePatchAction> =
  Extract<TilePatchCommand, { action: TAction; }>["tiles"][number];

interface TileChannel<TTile> {
  readonly channel: ChunkChannel;
  decode(encoded: TTile): { readonly tile: TileCoord; } | null;
  current(
    terrain: Pick<TerrainReader, "chunk">,
    tile: TileCoord
  ): TTile | undefined;
}

export type { PatchTile };

export const TILE_PATCH_ACTIONS = Object.keys(kTileChannels) as readonly TilePatchAction[];

export function isTilePatchCommand<TCommand extends TerrainCommand>(
  command: TCommand
): command is Extract<TCommand, { action: TilePatchAction; }> {
  return command.action in kTileChannels;
}

export function tileChannel(
  command: TilePatchCommand
): ChunkChannel {
  return channelOfAction(command.action);
}

export function channelOfAction(
  action: TilePatchAction
): ChunkChannel {
  return kTileChannels[action].channel;
}

export function patchedTiles(
  command: TilePatchCommand
): TileCoord[] {
  return command.tiles.flatMap((tile) => patchTileCoord(tile) ?? []);
}

export function fitsChunk(
  terrain: Pick<TerrainReader, "chunk" | "knows">,
  command: TilePatchCommand,
  tile: PatchTile
): boolean {
  const coord = new ChunkCoord(tile.x, tile.z);
  if (!terrain.knows(coord)) {
    return false;
  }

  const chunk = terrain.chunk(coord);

  return command.action === "splat-patched" || chunk === undefined || chunk.tier === (tile.tier ?? 1);
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
  const channel: TileChannel<EncodedTile<TilePatchAction>> = kTileChannels[command.action];
  const tiles: readonly EncodedTile<TilePatchAction>[] = command.tiles;

  return new Set(tiles.filter((tile) => channel.decode(tile) !== null));
}

export function currentTiles(
  terrain: Pick<TerrainReader, "chunk">,
  command: TilePatchCommand
): TilePatchCommand {
  const channel: TileChannel<EncodedTile<TilePatchAction>> = kTileChannels[command.action];
  const tiles = patchedTiles(command).flatMap((tile) => channel.current(terrain, tile) ?? []);

  return { action: command.action, tiles } as TilePatchCommand;
}
