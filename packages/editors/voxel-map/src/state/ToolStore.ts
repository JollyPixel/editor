// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// CONSTANTS
export const SELECT_MODES = ["box", "corners", "connected"] as const;

export type EditorTool = "brush" | "select";
export type SelectMode = typeof SELECT_MODES[number];

export type ToolStoreEvents = {
  change: (tool: EditorTool) => void;
  selectMode: (mode: SelectMode) => void;
};

export class ToolStore extends Emitter<ToolStoreEvents> {
  #current: EditorTool = "brush";
  #selectMode: SelectMode = "box";

  get current(): EditorTool {
    return this.#current;
  }

  set current(
    tool: EditorTool
  ) {
    if (this.#current === tool) {
      return;
    }

    this.#current = tool;
    this.emit("change", tool);
  }

  get selecting(): boolean {
    return this.#current === "select";
  }

  get selectMode(): SelectMode {
    return this.#selectMode;
  }

  set selectMode(
    mode: SelectMode
  ) {
    if (this.#selectMode === mode) {
      return;
    }

    this.#selectMode = mode;
    this.emit("selectMode", mode);
  }

  cycleSelectMode(): void {
    const next = SELECT_MODES.indexOf(this.#selectMode) + 1;
    this.selectMode = SELECT_MODES[next % SELECT_MODES.length];
  }
}
