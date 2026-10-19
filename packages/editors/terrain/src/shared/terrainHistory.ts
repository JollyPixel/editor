// Import Third-party Dependencies
import {
  terrainHistoryRegistration,
  type TerrainCommandDocument
} from "@jolly-pixel/asset.terrain/client";
import type {
  Keyboard,
  KeyChordString
} from "@jolly-pixel/controls";
import {
  CommandHistory,
  type HistoryRefusal,
  type HistoryStepInfo
} from "@jolly-pixel/history";

// CONSTANTS
const kLimit = 50;

export const TERRAIN_HISTORY_SCOPE = "terrain";
export const HISTORY_SHORTCUTS = {
  undo: ["Mod+z"],
  redo: ["Mod+y", "Mod+Shift+z"]
} as const satisfies Record<string, readonly KeyChordString[]>;

export type TerrainHistoryScope = typeof TERRAIN_HISTORY_SCOPE;
export type TerrainHistory = CommandHistory<TerrainHistoryScope>;

export function createTerrainHistory(
  document: TerrainCommandDocument
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

export function skippedMessage(
  step: HistoryStepInfo
): string {
  const label = step.label === null ? "a step" : `"${step.label}"`;

  return `Skipped ${label}: ${describeRefusal(step.refused)}`;
}

function describeRefusal(
  refusal: HistoryRefusal
): string {
  switch (refusal.reason) {
    case "peer":
      return refusal.clientId === null ? "it was changed since" : "a peer changed it since";
    case "changed":
      return "the terrain under it changed since";
    case "server":
      return "the server refused it";
    case "closed":
    case "gone":
      return "it is gone";
  }
}
