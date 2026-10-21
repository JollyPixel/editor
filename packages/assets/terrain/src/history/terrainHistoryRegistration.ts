// Import Third-party Dependencies
import {
  KeyedGuard,
  type HistoryKeys,
  type HistoryRegistration,
  type KeyedGuardEntry
} from "@jolly-pixel/history";
import type { TerrainReader } from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import type {
  TerrainDocument,
  TerrainImage
} from "../model/TerrainDocument.ts";
import { patchBatches } from "../network/patchBatches.ts";
import {
  terrainHeightTileKey,
  terrainWriteKeys,
  terrainWriteRefKey,
  terrainWriteRefs,
  type TerrainWriteRef
} from "../network/TerrainCommandKeys.ts";
import type {
  EncodedTilePatch,
  TerrainCommand
} from "../network/types.ts";

// CONSTANTS
const kDefaultId = "terrain";
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
  document: TerrainDocument,
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
  return terrainWriteRefs(command).map((ref) => {
    return {
      key: terrainWriteRefKey(ref),
      read: () => readWriteRef(terrain, ref)
    };
  });
}

function readWriteRef(
  terrain: TerrainReader,
  ref: TerrainWriteRef
): unknown {
  if (ref.kind === "chunk") {
    return terrain.has(ref.chunk);
  }

  const { tile } = ref;
  const heights = terrain.chunk(tile.chunk)?.tileHeights(tile.x, tile.z);

  return heights === undefined ? undefined : Array.from(heights);
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
  for (const batch of patchBatches([...tiles.values()])) {
    kept.push({ action: "heights-patched", tiles: batch });
  }

  return kept;
}
