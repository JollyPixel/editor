// Import Third-party Dependencies
import {
  KeyedGuard,
  type HistoryKeys,
  type HistoryRegistration,
  type KeyedGuardEntry
} from "@jolly-pixel/history";

// Import Internal Dependencies
import type {
  TerrainDocument,
  TerrainImage
} from "../model/TerrainDocument.ts";
import type { TerrainModelReader } from "../model/TerrainModel.ts";
import { patchBatches } from "../network/patchBatches.ts";
import {
  terrainHeightTileKey,
  terrainSplatTileKey,
  terrainWriteKeys,
  terrainWriteRefKey,
  terrainWriteRefs,
  type TerrainWriteRef
} from "../network/TerrainCommandKeys.ts";
import type {
  EncodedSplatTilePatch,
  EncodedTilePatch,
  TerrainCommand
} from "../network/types.ts";

// CONSTANTS
const kDefaultId = "terrain";
const kLabels: Readonly<Record<TerrainCommand["action"], string>> = {
  "chunk-added": "Add chunk",
  "chunk-removed": "Remove chunk",
  "heights-patched": "Sculpt",
  "splat-patched": "Paint",
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
    case "tile": {
      const { tile } = ref;
      const heights = terrain.chunk(tile.chunk)?.tileHeights(tile.x, tile.z);

      return heights === undefined ? undefined : Array.from(heights);
    }
    case "splat-tile": {
      const { tile } = ref;
      const splat = terrain.chunk(tile.chunk)?.splat.tile(tile.x, tile.z);

      return splat === undefined ? undefined : [...splat.indices, ...splat.weights];
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

function compactTilePatches(
  commands: readonly TerrainCommand[]
): TerrainCommand[] {
  const heights = new Map<string, EncodedTilePatch>();
  const splat = new Map<string, EncodedSplatTilePatch>();
  const kept: TerrainCommand[] = [];
  for (const command of commands) {
    if (command.action === "heights-patched") {
      for (const tile of command.tiles) {
        heights.set(terrainHeightTileKey(tile.x, tile.z, tile.tile), tile);
      }
    }
    else if (command.action === "splat-patched") {
      for (const tile of command.tiles) {
        splat.set(terrainSplatTileKey(tile.x, tile.z, tile.tile), tile);
      }
    }
    else {
      kept.push(command);
    }
  }
  for (const batch of patchBatches([...heights.values()])) {
    kept.push({ action: "heights-patched", tiles: batch });
  }
  for (const batch of patchBatches([...splat.values()])) {
    kept.push({ action: "splat-patched", tiles: batch });
  }

  return kept;
}
