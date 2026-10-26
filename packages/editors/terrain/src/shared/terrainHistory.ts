// Import Third-party Dependencies
import {
  terrainHistoryRegistration,
  type TerrainDocument
} from "@jolly-pixel/asset.terrain/client";
import type {
  Keyboard,
  KeyChordString
} from "@jolly-pixel/controls";
import {
  CommandHistory,
  type RefusalWording
} from "@jolly-pixel/history";

// CONSTANTS
const kLimit = 50;

export const TERRAIN_HISTORY_SCOPE = "terrain";
export const TERRAIN_REFUSAL_WORDING: RefusalWording = {
  changed: "the terrain under it changed since"
};
export const HISTORY_SHORTCUTS = {
  undo: ["Mod+z"],
  redo: ["Mod+y", "Mod+Shift+z"]
} as const satisfies Record<string, readonly KeyChordString[]>;

export type TerrainHistoryScope = typeof TERRAIN_HISTORY_SCOPE;
export type TerrainHistory = CommandHistory<TerrainHistoryScope>;

export function createTerrainHistory(
  document: TerrainDocument
): TerrainHistory {
  const history = new CommandHistory<TerrainHistoryScope>({ limit: kLimit });
  history.register(
    terrainHistoryRegistration(document, { scope: TERRAIN_HISTORY_SCOPE })
  );

  return history;
}

export function bindHistoryShortcuts(
  keyboard: Pick<Keyboard, "bind">,
  history: TerrainHistory
): () => void {
  const releases = [
    keyboard.bind(HISTORY_SHORTCUTS.undo, () => {
      history.undo(TERRAIN_HISTORY_SCOPE);
    }),
    keyboard.bind(HISTORY_SHORTCUTS.redo, () => {
      history.redo(TERRAIN_HISTORY_SCOPE);
    })
  ];

  return () => {
    for (const release of releases) {
      release();
    }
  };
}
