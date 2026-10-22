// Import Third-party Dependencies
import {
  ChunkCoord,
  TileCoord,
  type TerrainReader
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import { terrainHeightTileKey } from "./TerrainCommandKeys.ts";
import {
  decodeTilePatch,
  encodeTilePatch
} from "./tilePatches.ts";
import type {
  EncodedTilePatch,
  TerrainNetworkCommand
} from "./types.ts";

export function admissibleTiles(
  state: TerrainReader,
  command: TerrainNetworkCommand
): TerrainNetworkCommand | null {
  if (command.action !== "heights-patched") {
    return command;
  }

  const keys = new Set(command.tiles.map(tileKey));
  if (keys.size !== command.tiles.length) {
    return null;
  }

  const tiles = command.tiles.filter((tile) => state.knows(new ChunkCoord(tile.x, tile.z)) &&
    decodeTilePatch(tile) !== null);
  if (tiles.length === command.tiles.length) {
    return command;
  }

  return tiles.length === 0 ? null : { ...command, tiles };
}

export function correctTerrainCommand(
  state: TerrainReader,
  command: TerrainNetworkCommand,
  admitted: TerrainNetworkCommand | null
): TerrainNetworkCommand | null {
  if (command.action !== "heights-patched") {
    return null;
  }

  const kept = new Set(admitted?.action === "heights-patched" ? admitted.tiles.map(tileKey) : []);
  const refused = command.tiles.filter((tile) => !kept.has(tileKey(tile)));
  const current: EncodedTilePatch[] = [];
  for (const { x, z, tile: index } of refused) {
    const tile = TileCoord.fromIndex(new ChunkCoord(x, z), index);
    const heights = state.chunk(tile.chunk)?.tileHeights(tile.x, tile.z);
    if (heights !== undefined) {
      current.push(encodeTilePatch({ tile, heights }));
    }
  }

  const { clientId, seq, timestamp } = command;
  if (current.length > 0) {
    return { clientId, seq, timestamp, action: "heights-patched", tiles: current };
  }
  if (admitted !== null) {
    return admitted;
  }

  const missing = refused.find(({ x, z }) => !state.knows(new ChunkCoord(x, z)));

  return missing === undefined ?
    null :
    { clientId, seq, timestamp, action: "chunk-removed", x: missing.x, z: missing.z };
}

function tileKey(
  { x, z, tile }: EncodedTilePatch
): string {
  return terrainHeightTileKey(x, z, tile);
}
