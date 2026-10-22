// Import Third-party Dependencies
import type { KeyBindingHandlers } from "@jolly-pixel/controls";

// Import Internal Dependencies
import type { ActiveHistory } from "./ActiveHistory.ts";

export type HistoryAction = "undo" | "redo";

export interface HistoryShortcutsOptions {
  history: Pick<ActiveHistory, HistoryAction>;
}

export function historyShortcuts(
  options: HistoryShortcutsOptions
): KeyBindingHandlers<`edit.${HistoryAction}`> {
  const { history } = options;

  return {
    "edit.undo": () => {
      history.undo();
    },
    "edit.redo": () => {
      history.redo();
    }
  };
}
