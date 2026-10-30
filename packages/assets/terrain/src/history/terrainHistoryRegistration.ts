// Import Third-party Dependencies
import {
  KeyedGuard,
  type HistoryKeys,
  type HistoryRegistration,
  type KeyedGuardEntry
} from "@jolly-pixel/history";
import type {
  TerrainChunk,
  TileCoord
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import type {
  TerrainDocument,
  TerrainImage
} from "../model/TerrainDocument.ts";
import type { TerrainModelReader } from "../model/TerrainModel.ts";
import { patchBatches } from "../network/patchBatches.ts";
import {
  terrainTileKey,
  terrainWriteKeys,
  terrainWriteRefKey,
  terrainWriteRefs,
  type TerrainWriteRef
} from "../network/TerrainCommandKeys.ts";
import {
  isTilePatchCommand,
  type ChunkChannel,
  type PatchTile
} from "../network/tilePatchCommands.ts";
import type { TerrainCommand } from "../network/types.ts";

// CONSTANTS
const kDefaultId = "terrain";
const kLabels: Readonly<Record<TerrainCommand["action"], string>> = {
  "chunk-added": "Add chunk",
  "chunk-removed": "Remove chunk",
  "tier-changed": "Change detail",
  "heights-patched": "Sculpt",
  "splat-patched": "Paint",
  "holes-patched": "Edit holes",
  "material-added": "Add material",
  "material-updated": "Edit material",
  "material-removed": "Remove material",
  "texture-size-changed": "Change texture size"
};

export interface TerrainHistoryRegistrationOptions<TScope extends string> {
  /**
   * @default "terrain"
   */
  id?: string;
  scope: TScope;
}

export function terrainHistoryRegistration<TScope extends string>(
  document: TerrainDocument,
  options: TerrainHistoryRegistrationOptions<TScope>
): HistoryRegistration<TScope, TerrainCommand, TerrainImage> {
  const { id = kDefaultId, scope } = options;

  return {
    id,
    document,
    keys: terrainHistoryKeys(document),
    resolveScope: () => scope,
    label: ({ command }) => kLabels[command.action],
    compact: compactTilePatches
  };
}

export function terrainHistoryKeys(
  model: TerrainModelReader
): HistoryKeys<TerrainCommand, TerrainImage> {
  return {
    written: ({ command }) => terrainWriteKeys(command),
    guard: (commands) => new KeyedGuard(
      commands.flatMap((command) => guardEntries(model, command))
    )
  };
}

function guardEntries(
  model: TerrainModelReader,
  command: TerrainCommand
): KeyedGuardEntry[] {
  return terrainWriteRefs(command).map((ref) => {
    return {
      key: terrainWriteRefKey(ref),
      read: () => readWriteRef(model, ref)
    };
  });
}

function readWriteRef(
  { terrain, materials }: TerrainModelReader,
  ref: TerrainWriteRef
): unknown {
  switch (ref.kind) {
    case "chunk":
      return terrain.has(ref.chunk);
    case "tier":
      return terrain.chunk(ref.chunk)?.tier;
    case "tile": {
      const { tile } = ref;
      const chunk = terrain.chunk(tile.chunk);
      if (chunk === undefined || (ref.channel !== "splat" && chunk.tier !== tile.tier)) {
        return undefined;
      }

      return readTile(chunk, ref.channel, tile);
    }
    case "material": {
      const material = materials.material(ref.id);
      if (ref.field === null) {
        return material !== undefined;
      }

      return material?.[ref.field];
    }
    case "texture-size":
      return materials.textureSize;
  }
}

function readTile(
  chunk: TerrainChunk,
  channel: ChunkChannel,
  tile: TileCoord
): number[] {
  switch (channel) {
    case "heights":
      return Array.from(chunk.tileHeights(tile.x, tile.z));
    case "splat": {
      const splat = chunk.splat.tile(tile.x, tile.z);

      return [...splat.indices, ...splat.weights];
    }
    case "holes":
      return Array.from(chunk.holes.tile(tile.x, tile.z));
  }
}

function compactTilePatches(
  commands: readonly TerrainCommand[]
): TerrainCommand[] {
  const kept: TerrainCommand[] = commands.filter((command) => !isTilePatchCommand(command));
  const heights = latestTiles(
    "heights",
    commands.flatMap((command) => (command.action === "heights-patched" ? command.tiles : []))
  );
  const splat = latestTiles(
    "splat",
    commands.flatMap((command) => (command.action === "splat-patched" ? command.tiles : []))
  );
  const holes = latestTiles(
    "holes",
    commands.flatMap((command) => (command.action === "holes-patched" ? command.tiles : []))
  );
  for (const batch of patchBatches(heights)) {
    kept.push({ action: "heights-patched", tiles: batch });
  }
  for (const batch of patchBatches(splat)) {
    kept.push({ action: "splat-patched", tiles: batch });
  }
  for (const batch of patchBatches(holes)) {
    kept.push({ action: "holes-patched", tiles: batch });
  }

  return kept;
}

function latestTiles<TTile extends PatchTile>(
  channel: ChunkChannel,
  tiles: readonly TTile[]
): TTile[] {
  const latest = new Map<string, TTile>();
  for (const tile of tiles) {
    latest.set(terrainTileKey(channel, tile.x, tile.z, tile.tile, tile.tier), tile);
  }

  return [...latest.values()];
}
