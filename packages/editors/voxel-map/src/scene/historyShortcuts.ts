// Import Third-party Dependencies
import type { VoxelHistory } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  bindKeys,
  type KeyBindingTarget
} from "../shared/keyBindings.ts";

export interface HistoryShortcutsOptions {
  keyboard: KeyBindingTarget;
  history: Pick<VoxelHistory, "undo" | "redo">;
}

export function bindHistoryShortcuts(
  options: HistoryShortcutsOptions
): () => void {
  const { history } = options;

  return bindKeys(options.keyboard, ["KeyZ", "KeyY"], (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) {
      return;
    }

    if (event.code === "KeyY" || (event.code === "KeyZ" && event.shiftKey)) {
      history.redo();
    }
    else if (event.code === "KeyZ") {
      history.undo();
    }
    else {
      return;
    }

    event.preventDefault();
  });
}
