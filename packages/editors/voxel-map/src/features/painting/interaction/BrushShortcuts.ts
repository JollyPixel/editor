// Import Third-party Dependencies
import type { Keyboard } from "@jolly-pixel/controls";

// Import Internal Dependencies
import type {
  BrushStore,
  SelectionStore
} from "../../../state/index.ts";
import {
  BRUSH_AXES,
  type BrushAxis
} from "../model/brushFootprint.ts";

export type BrushShortcutCode =
  | "KeyR"
  | "KeyX"
  | "KeyC"
  | "KeyG"
  | "BracketLeft"
  | "BracketRight";

export interface BrushShortcutsOptions {
  keyboard: Pick<Keyboard, "on" | "off">;
  brush: BrushStore;
  selection: SelectionStore;
}

export const BRUSH_SHORTCUT_CODES: readonly BrushShortcutCode[] = [
  "KeyR",
  "KeyX",
  "KeyC",
  "KeyG",
  "BracketLeft",
  "BracketRight"
];

export class BrushShortcuts {
  #keyboard: Pick<Keyboard, "on" | "off">;
  #brush: BrushStore;
  #selection: SelectionStore;

  #onKey = (
    event: KeyboardEvent
  ): void => {
    if (!this.#accepts(event)) {
      return;
    }

    switch (event.code) {
      case "KeyR":
        this.#brush.mode = this.#brush.mode === "build" ? "replace" : "build";
        break;
      case "KeyX":
        this.#brush.axis = nextAxis(this.#brush.axis);
        break;
      case "KeyC":
        this.#brush.pattern = this.#brush.pattern === "square" ? "circle" : "square";
        break;
      case "KeyG":
        this.#brush.ghost = !this.#brush.ghost;
        break;
      case "BracketLeft":
        this.#brush.resize(-1);
        break;
      case "BracketRight":
        this.#brush.resize(1);
        break;
      default:
        return;
    }

    event.preventDefault();
  };

  constructor(
    options: BrushShortcutsOptions
  ) {
    this.#keyboard = options.keyboard;
    this.#brush = options.brush;
    this.#selection = options.selection;

    for (const code of BRUSH_SHORTCUT_CODES) {
      this.#keyboard.on(code, this.#onKey);
    }
  }

  dispose(): void {
    for (const code of BRUSH_SHORTCUT_CODES) {
      this.#keyboard.off(code, this.#onKey);
    }
  }

  #accepts(
    event: KeyboardEvent
  ): boolean {
    if (
      event.ctrlKey ||
      event.altKey ||
      event.shiftKey ||
      event.metaKey ||
      this.#selection.voxelLayer === null
    ) {
      return false;
    }
    if (
      event.repeat &&
      event.code !== "BracketLeft" &&
      event.code !== "BracketRight"
    ) {
      return false;
    }

    return true;
  }
}

export function nextAxis(
  axis: BrushAxis
): BrushAxis {
  const index = BRUSH_AXES.indexOf(axis);

  return BRUSH_AXES[(index + 1) % BRUSH_AXES.length];
}
