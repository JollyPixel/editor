// Import Third-party Dependencies
import type { VoxelHistory } from "@jolly-pixel/voxel.renderer";

export type HistoryShortcutCode =
  | "KeyZ"
  | "KeyY";

export type HistoryShortcutListener = (event: KeyboardEvent) => void;

export interface HistoryShortcutKeyboard {
  on(code: HistoryShortcutCode, listener: HistoryShortcutListener): unknown;
  off(code: HistoryShortcutCode, listener: HistoryShortcutListener): unknown;
}

export interface HistoryShortcutsOptions {
  keyboard: HistoryShortcutKeyboard;
  history: Pick<VoxelHistory, "undo" | "redo">;
}

export const HISTORY_SHORTCUT_CODES: readonly HistoryShortcutCode[] = [
  "KeyZ",
  "KeyY"
];

export class HistoryShortcuts {
  #keyboard: HistoryShortcutKeyboard;
  #history: Pick<VoxelHistory, "undo" | "redo">;

  #onKey = (
    event: KeyboardEvent
  ): void => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) {
      return;
    }

    const redo = event.code === "KeyY" ||
      (event.code === "KeyZ" && event.shiftKey);
    if (redo) {
      this.#history.redo();
    }
    else if (event.code === "KeyZ") {
      this.#history.undo();
    }
    else {
      return;
    }

    event.preventDefault();
  };

  constructor(
    options: HistoryShortcutsOptions
  ) {
    this.#keyboard = options.keyboard;
    this.#history = options.history;

    for (const code of HISTORY_SHORTCUT_CODES) {
      this.#keyboard.on(code, this.#onKey);
    }
  }

  dispose(): void {
    for (const code of HISTORY_SHORTCUT_CODES) {
      this.#keyboard.off(code, this.#onKey);
    }
  }
}
