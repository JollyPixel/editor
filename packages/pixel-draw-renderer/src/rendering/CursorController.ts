// Import Internal Dependencies
import type { Tools } from "../tools/Tools.ts";
import type { Mode } from "../types.ts";
import type { CanvasRenderer } from "./CanvasRenderer.ts";

export interface CursorControllerOptions {
  renderer: CanvasRenderer;
  tools: Tools;
}

/**
 * Resolves and applies the canvas cursor for a given mode, reflecting
 * per-tool drag/selection state (grab/grabbing in "uv" and "select").
 */
export class CursorController {
  #renderer: CanvasRenderer;
  #tools: Tools;

  constructor(
    options: CursorControllerOptions
  ) {
    this.#renderer = options.renderer;
    this.#tools = options.tools;
  }

  refresh(
    mode: Mode
  ): void {
    this.#renderer.cursor = this.#resolve(mode);
  }

  #resolve(
    mode: Mode
  ): string {
    switch (mode) {
      case "uv":
        return this.#tools.uv.isDragging ? "grabbing" : "grab";

      case "select":
        if (this.#tools.select.isDragging) {
          return "grabbing";
        }

        return this.#tools.select.hasSelection ? "grab" : "";

      default:
        return "";
    }
  }
}
