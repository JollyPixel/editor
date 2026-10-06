// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

export type EditorTool = "brush" | "select";

export type ToolStoreEvents = {
  change: (tool: EditorTool) => void;
};

export class ToolStore extends Emitter<ToolStoreEvents> {
  #current: EditorTool = "brush";

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
}
