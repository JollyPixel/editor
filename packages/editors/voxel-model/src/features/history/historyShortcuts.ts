// Import Third-party Dependencies
import {
  KeyChord,
  type Keyboard,
  type KeyChordString
} from "@jolly-pixel/controls";

// Import Internal Dependencies
import type { ActiveHistory } from "./ActiveHistory.ts";
import { combineReleases } from "../../shared/combineReleases.ts";

export const HISTORY_SHORTCUTS = {
  undo: ["Mod+z"],
  redo: ["Mod+y", "Mod+Shift+z"]
} as const satisfies Record<string, readonly KeyChordString[]>;

export type HistoryAction = keyof typeof HISTORY_SHORTCUTS;

export interface HistoryShortcutsOptions {
  keyboard: Pick<Keyboard, "bind">;
  history: Pick<ActiveHistory, HistoryAction>;
}

export function historyShortcutLabel(
  action: HistoryAction
): string {
  return KeyChord.parse(HISTORY_SHORTCUTS[action][0]).format();
}

export function bindHistoryShortcuts(
  options: HistoryShortcutsOptions
): () => void {
  const { keyboard, history } = options;

  return combineReleases([
    keyboard.bind(HISTORY_SHORTCUTS.undo, () => {
      history.undo();
    }),
    keyboard.bind(HISTORY_SHORTCUTS.redo, () => {
      history.redo();
    })
  ]);
}
