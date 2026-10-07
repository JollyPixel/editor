// Import Third-party Dependencies
import type {
  Keyboard,
  KeyChordString
} from "@jolly-pixel/controls";

export const HISTORY_SHORTCUTS = {
  undo: ["Mod+z"],
  redo: ["Mod+y", "Mod+Shift+z"]
} as const satisfies Record<string, readonly KeyChordString[]>;

export interface HistoryShortcutsOptions {
  keyboard: Pick<Keyboard, "bind">;
  history: {
    undo(): boolean;
    redo(): boolean;
  };
}

export function bindHistoryShortcuts(
  options: HistoryShortcutsOptions
): () => void {
  const { keyboard, history } = options;
  const releases = [
    keyboard.bind(HISTORY_SHORTCUTS.undo, () => {
      history.undo();
    }),
    keyboard.bind(HISTORY_SHORTCUTS.redo, () => {
      history.redo();
    })
  ];

  return () => {
    for (const release of releases) {
      release();
    }
  };
}
