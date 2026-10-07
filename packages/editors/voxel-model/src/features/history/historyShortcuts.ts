// Import Third-party Dependencies
import {
  KeyChord,
  type Keyboard,
  type KeyChordString
} from "@jolly-pixel/controls";

// Import Internal Dependencies
import type { TabStore } from "../../state/index.ts";
import type { EditorHistory } from "./editorHistory.ts";

export const HISTORY_SHORTCUTS = {
  undo: ["Mod+z"],
  redo: ["Mod+y", "Mod+Shift+z"]
} as const satisfies Record<string, readonly KeyChordString[]>;

export type HistoryAction = keyof typeof HISTORY_SHORTCUTS;

export interface HistoryShortcutsOptions {
  keyboard: Pick<Keyboard, "bind">;
  history: Pick<EditorHistory, HistoryAction>;
  tab: Pick<TabStore, "active">;
}

export function historyShortcutLabel(
  action: HistoryAction
): string {
  return KeyChord.parse(HISTORY_SHORTCUTS[action][0]).format();
}

export function bindHistoryShortcuts(
  options: HistoryShortcutsOptions
): () => void {
  const { keyboard, history, tab } = options;
  const releases = [
    keyboard.bind(HISTORY_SHORTCUTS.undo, () => {
      history.undo(tab.active);
    }),
    keyboard.bind(HISTORY_SHORTCUTS.redo, () => {
      history.redo(tab.active);
    })
  ];

  return () => {
    for (const release of releases) {
      release();
    }
  };
}
