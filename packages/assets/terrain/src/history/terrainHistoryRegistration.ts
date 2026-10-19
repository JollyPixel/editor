// Import Third-party Dependencies
import {
  KeyedGuard,
  type HistoryKeys,
  type HistoryRegistration,
  type KeyedGuardEntry
} from "@jolly-pixel/history";
import {
  ChunkCoord,
  TILES_PER_CHUNK,
  TileCoord,
  type TerrainReader
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import type {
  TerrainCommandDocument,
  TerrainImage
} from "../model/TerrainCommandDocument.ts";
import { MAX_PATCH_TILES } from "../network/TerrainCommand.schema.ts";
import {
  terrainChunkKey,
  terrainHeightTileKey,
  terrainWriteKeys
} from "../network/TerrainCommandKeys.ts";
import type {
  EncodedTilePatch,
  TerrainCommand
} from "../network/types.ts";

// CONSTANTS
const kDefaultId = "terrain";
const kTilesPerChunk = TILES_PER_CHUNK * TILES_PER_CHUNK;
const kLabels: Readonly<Record<TerrainCommand["action"], string>> = {
  "chunk-added": "Add chunk",
  "chunk-removed": "Remove chunk",
  "heights-patched": "Sculpt"
};

export interface TerrainHistoryRegistrationOptions<TScope extends string> {
  /**
   * @default "terrain"
   */
  id?: string;
  scope: TScope;
}

export function terrainHistoryRegistration<TScope extends string>(
  document: TerrainCommandDocument,
  options: TerrainHistoryRegistrationOptions<TScope>
): HistoryRegistration<TScope, TerrainCommand, TerrainImage> {
  const { id = kDefaultId, scope } = options;

  return {
    id,
    document,
    keys: terrainHistoryKeys(document.terrain),
    resolveScope: () => scope,
    label: ({ command }) => kLabels[command.action],
    compact: compactHeightPatches
  };
}

export function terrainHistoryKeys(
  terrain: TerrainReader
): HistoryKeys<TerrainCommand, TerrainImage> {
  return {
    written: ({ command }) => terrainWriteKeys(command),
    guard: (commands) => new KeyedGuard(
      commands.flatMap((command) => guardEntries(terrain, command))
    )
  };
}

function guardEntries(
  terrain: TerrainReader,
  command: TerrainCommand
): KeyedGuardEntry[] {
  if (command.action === "heights-patched") {
    return command.tiles.map(
      ({ x, z, tile }) => tileEntry(terrain, TileCoord.fromIndex(new ChunkCoord(x, z), tile))
    );
  }

  const chunk = new ChunkCoord(command.x, command.z);

  return [
    { key: terrainChunkKey(chunk.x, chunk.z), read: () => terrain.has(chunk) },
    ...Array.from(
      { length: kTilesPerChunk },
      (_, index) => tileEntry(terrain, TileCoord.fromIndex(chunk, index))
    )
  ];
}

function tileEntry(
  terrain: TerrainReader,
  tile: TileCoord
): KeyedGuardEntry {
  return {
    key: terrainHeightTileKey(tile.chunk.x, tile.chunk.z, tile.index),
    read: () => {
      const heights = terrain.chunk(tile.chunk)?.tileHeights(tile.x, tile.z);

      return heights === undefined ? undefined : Array.from(heights);
    }
  };
}

function compactHeightPatches(
  commands: readonly TerrainCommand[]
): TerrainCommand[] {
  const tiles = new Map<string, EncodedTilePatch>();
  const kept: TerrainCommand[] = [];
  for (const command of commands) {
    if (command.action !== "heights-patched") {
      kept.push(command);
      continue;
    }

    for (const tile of command.tiles) {
      tiles.set(terrainHeightTileKey(tile.x, tile.z, tile.tile), tile);
    }
  }
  const merged = [...tiles.values()];
  for (let start = 0; start < merged.length; start += MAX_PATCH_TILES) {
    kept.push({ action: "heights-patched", tiles: merged.slice(start, start + MAX_PATCH_TILES) });
  }

  return kept;
}
