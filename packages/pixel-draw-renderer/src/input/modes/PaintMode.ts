// Import Internal Dependencies
import {
  StrokeMode,
  type StrokeModeOptions
} from "./StrokeMode.ts";
import type { BrushEngine } from "../../tools/BrushEngine.ts";
import type {
  Mode,
  Vec2
} from "../../types.ts";

export type PaintModeOptions = StrokeModeOptions;

export class PaintMode extends StrokeMode {
  readonly id: Mode = "paint";

  #brush: BrushEngine;

  constructor(
    options: PaintModeOptions
  ) {
    super(options);
    this.#brush = options.brush;
  }

  onExit(): void {
    super.onExit();
    this.#brush.pickArmed = false;
  }

  highlightSize(
    brushSize: number
  ): number {
    return this.#brush.pickArmed ? 1 : brushSize;
  }

  onPrimaryDown(
    pos: Vec2
  ): boolean {
    if (this.#brush.pickArmed) {
      this.#brush.pick(pos.x, pos.y);

      return false;
    }

    return super.onPrimaryDown(pos);
  }

  onSecondaryDown(
    pos: Vec2,
    ctrlKey: boolean
  ): boolean {
    if (this.#brush.pickArmed) {
      this.#brush.pick(
        pos.x,
        pos.y,
        "secondary"
      );

      return false;
    }

    if (ctrlKey) {
      this.#brush.pick(
        pos.x,
        pos.y
      );

      return false;
    }

    return super.onSecondaryDown(
      pos,
      ctrlKey
    );
  }
}
