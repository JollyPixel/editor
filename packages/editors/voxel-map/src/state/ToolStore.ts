// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

export type EditorTool = "brush" | "select";
export type SelectMode = "box" | "connected";

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
    this.selectMode = this.#selectMode === "box" ? "connected" : "box";
  }
}
