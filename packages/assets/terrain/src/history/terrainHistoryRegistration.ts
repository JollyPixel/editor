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
  channelOfAction,
  isTilePatchCommand,
  TILE_PATCH_ACTIONS,
  type ChunkChannel,
  type PatchTile,
  type TilePatchAction,
  type TilePatchCommand
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
  "texture-size-changed": "Change texture size",
  "poi-added": "Add point of interest",
  "poi-updated": "Edit point of interest",
  "poi-removed": "Remove point of interest"
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
    compact: (commands) => (commands.every((command) => document.isPaired(command)) ?
      [...commands] :
      compactTilePatches(commands))
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
  { terrain, materials, pointsOfInterest }: TerrainModelReader,
  ref: TerrainWriteRef
): unknown {
  switch (ref.kind) {
    case "poi": {
      const point = pointsOfInterest.pointOfInterest(ref.id);

      return ref.field === null ? point !== undefined : point?.[ref.field];
    }
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
  return [
    ...commands.filter((command) => !isTilePatchCommand(command)),
    ...TILE_PATCH_ACTIONS.flatMap((action) => latestTileBatches(commands, action))
  ];
}

function latestTileBatches(
  commands: readonly TerrainCommand[],
  action: TilePatchAction
): TilePatchCommand[] {
  const latest = new Map<string, PatchTile>();
  for (const command of commands) {
    if (isTilePatchCommand(command) && command.action === action) {
      const tiles: readonly PatchTile[] = command.tiles;
      for (const tile of tiles) {
        latest.set(terrainTileKey(channelOfAction(action), tile.x, tile.z, tile.tile, tile.tier), tile);
      }
    }
  }

  const batches: TilePatchCommand[] = [];
  for (const tiles of patchBatches([...latest.values()])) {
    batches.push({ action, tiles } as TilePatchCommand);
  }

  return batches;
}
