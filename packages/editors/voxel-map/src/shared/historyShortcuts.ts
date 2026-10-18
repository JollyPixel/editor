// Import Third-party Dependencies
import type { KeyBindingHandlers } from "@jolly-pixel/controls";

export interface HistoryShortcutsOptions {
  history: {
    undo(): boolean;
    redo(): boolean;
  };
}

export function historyShortcuts(
  options: HistoryShortcutsOptions
): KeyBindingHandlers<"edit.undo" | "edit.redo"> {
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
