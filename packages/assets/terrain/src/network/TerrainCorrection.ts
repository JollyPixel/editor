// Import Third-party Dependencies
import {
  ChunkCoord,
  type TerrainReader
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  currentSplatTilePatches,
  decodeSplatTilePatch
} from "./splat.ts";
import {
  terrainHeightTileKey,
  terrainSplatTileKey
} from "./TerrainCommandKeys.ts";
import {
  currentTilePatches,
  decodeTilePatch
} from "./tilePatches.ts";
import type {
  EncodedSplatTilePatch,
  EncodedTilePatch,
  TerrainNetworkCommand
} from "./types.ts";

type TilePatchCommand = Extract<
  TerrainNetworkCommand,
  { action: "heights-patched" | "splat-patched"; }
>;

interface PatchTile {
  readonly x: number;
  readonly z: number;
  readonly tile: number;
}

export function admissibleTiles(
  state: TerrainReader,
  command: TerrainNetworkCommand
): TerrainNetworkCommand | null {
  if (!isTilePatchCommand(command)) {
    return command;
  }

  const tiles: readonly PatchTile[] = command.tiles;
  const keys = new Set(tiles.map((tile) => tileKey(command, tile)));
  if (keys.size !== tiles.length) {
    return null;
  }

  const admitted = tiles.filter((tile) => state.knows(new ChunkCoord(tile.x, tile.z)) &&
    decodes(command, tile));
  if (admitted.length === tiles.length) {
    return command;
  }

  return admitted.length === 0 ? null : { ...command, tiles: admitted } as TerrainNetworkCommand;
}

export function correctTerrainCommand(
  state: TerrainReader,
  command: TerrainNetworkCommand,
  admitted: TerrainNetworkCommand | null
): TerrainNetworkCommand | null {
  if (!isTilePatchCommand(command)) {
    return null;
  }

  const tiles: readonly PatchTile[] = command.tiles;
  const kept = new Set(
    admitted?.action === command.action ?
      (admitted.tiles as readonly PatchTile[]).map((tile) => tileKey(command, tile)) :
      []
  );
  const refused = tiles.filter((tile) => !kept.has(tileKey(command, tile)));
  const { clientId, seq, timestamp } = command;
  const correction = currentTiles(state, command, refused);
  if (correction !== null) {
    return { clientId, seq, timestamp, ...correction };
  }
  if (admitted !== null) {
    return admitted;
  }

  const missing = refused.find(({ x, z }) => !state.knows(new ChunkCoord(x, z)));

  return missing === undefined ?
    null :
    { clientId, seq, timestamp, action: "chunk-removed", x: missing.x, z: missing.z };
}

function currentTiles(
  state: TerrainReader,
  command: TilePatchCommand,
  refused: readonly PatchTile[]
) {
  if (command.action === "heights-patched") {
    const tiles = currentTilePatches(state, refused as readonly EncodedTilePatch[]);

    return tiles.length === 0 ? null : { action: "heights-patched" as const, tiles };
  }

  const tiles = currentSplatTilePatches(state, refused as readonly EncodedSplatTilePatch[]);

  return tiles.length === 0 ? null : { action: "splat-patched" as const, tiles };
}

function isTilePatchCommand(
  command: TerrainNetworkCommand
): command is TilePatchCommand {
  return command.action === "heights-patched" || command.action === "splat-patched";
}

function decodes(
  command: TilePatchCommand,
  tile: PatchTile
): boolean {
  return command.action === "heights-patched" ?
    decodeTilePatch(tile as EncodedTilePatch) !== null :
    decodeSplatTilePatch(tile as EncodedSplatTilePatch) !== null;
}

function tileKey(
  command: TilePatchCommand,
  { x, z, tile }: PatchTile
): string {
  return command.action === "heights-patched" ?
    terrainHeightTileKey(x, z, tile) :
    terrainSplatTileKey(x, z, tile);
}
