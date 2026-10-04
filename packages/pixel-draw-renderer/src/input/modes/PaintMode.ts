// Import Internal Dependencies
import {
  StrokeMode,
  type StrokeModeOptions
} from "./StrokeMode.ts";
import type { PointerPosition } from "../InputActions.ts";
import type { BrushColorSlot } from "../../tools/Brush.ts";
import type { BrushEngine } from "../../tools/BrushEngine.ts";

export type PaintModeOptions = Omit<StrokeModeOptions, "id" | "erase">;

export class PaintMode extends StrokeMode {
  #engine: BrushEngine;

  constructor(
    options: PaintModeOptions
  ) {
    super({
      ...options,
      id: "paint",
      erase: false
    });
    this.#engine = options.engine;
  }

  onExit(): void {
    super.onExit();
    this.#engine.pickArmed = false;
  }

  highlightSize(): number {
    return this.#engine.pickArmed ? 1 : super.highlightSize();
  }

  onPointerDown(
    slot: BrushColorSlot,
    position: PointerPosition,
    ctrlKey: boolean
  ): boolean {
    const { x, y } = position.texture;
    if (this.#engine.pickArmed) {
      this.#engine.pick(x, y, slot);

      return false;
    }
    if (ctrlKey && slot === "secondary") {
      this.#engine.pick(x, y);

      return false;
    }

    return super.onPointerDown(slot, position, ctrlKey);
  }
}
