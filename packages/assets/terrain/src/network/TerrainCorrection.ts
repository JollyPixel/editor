// Import Third-party Dependencies
import {
  ChunkCoord,
  type TerrainReader
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import { terrainTileKey } from "./TerrainCommandKeys.ts";
import { currentTier } from "./tierCommands.ts";
import {
  currentTiles,
  decodableTiles,
  filterTiles,
  fitsChunk,
  isTilePatchCommand,
  tileChannel,
  type PatchTile,
  type TilePatchCommand
} from "./tilePatchCommands.ts";
import type { TerrainNetworkCommand } from "./types.ts";

export function admissibleTiles(
  state: TerrainReader,
  command: TerrainNetworkCommand
): TerrainNetworkCommand | null {
  if (!isTilePatchCommand(command)) {
    return command;
  }

  const keys = new Set(command.tiles.map((tile) => tileKey(command, tile)));
  if (keys.size !== command.tiles.length) {
    return null;
  }

  const decodable = decodableTiles(command);
  const admitted = filterTiles(
    command,
    (tile) => fitsChunk(state, command, tile) && decodable.has(tile)
  );
  if (admitted.tiles.length === command.tiles.length) {
    return command;
  }

  return admitted.tiles.length === 0 ? null : admitted;
}

export function correctTerrainCommand(
  state: TerrainReader,
  command: TerrainNetworkCommand,
  admitted: TerrainNetworkCommand | null
): TerrainNetworkCommand | null {
  if (!isTilePatchCommand(command)) {
    return null;
  }

  const kept = new Set(
    admitted !== null && isTilePatchCommand(admitted) ?
      admitted.tiles.map((tile: PatchTile) => tileKey(admitted, tile)) :
      []
  );
  const refused = filterTiles(command, (tile) => !kept.has(tileKey(command, tile)));
  const { clientId, seq, timestamp } = command;
  const correction = currentTiles(state, refused);
  if (correction.tiles.length > 0) {
    return { clientId, seq, timestamp, ...correction };
  }
  if (admitted !== null) {
    return admitted;
  }

  const missing = refused.tiles.find(({ x, z }) => !state.knows(new ChunkCoord(x, z)));
  if (missing !== undefined) {
    return { clientId, seq, timestamp, action: "chunk-removed", x: missing.x, z: missing.z };
  }

  const changed = refused.tiles
    .map(({ x, z }) => state.chunk(new ChunkCoord(x, z)))
    .find((chunk) => chunk !== undefined);

  return changed === undefined ?
    null :
    { clientId, seq, timestamp, ...currentTier(changed) };
}

function tileKey(
  command: TilePatchCommand,
  { x, z, tile, tier }: PatchTile
): string {
  return terrainTileKey(tileChannel(command), x, z, tile, tier);
}
