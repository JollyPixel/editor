// Import Third-party Dependencies
import type {
  Keyboard,
  KeyChordString
} from "@jolly-pixel/controls";
import type { VoxelHistory } from "@jolly-pixel/voxel.renderer";

export const HISTORY_SHORTCUTS = {
  undo: ["Mod+KeyZ"],
  redo: ["Mod+KeyY", "Mod+Shift+KeyZ"]
} as const satisfies Record<string, readonly KeyChordString[]>;

export interface HistoryShortcutsOptions {
  keyboard: Pick<Keyboard, "bind">;
  history: Pick<VoxelHistory, "undo" | "redo">;
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
