// Import Internal Dependencies
import { InteractionMode } from "./InteractionMode.ts";
import type { PointerPosition } from "../InputActions.ts";
import type { BrushColorSlot } from "../../tools/Brush.ts";
import type { SelectEngine } from "../../tools/SelectEngine.ts";
import type {
  Mode,
  RotationDirection,
  Vec2
} from "../../types.ts";

export interface SelectModeOptions {
  select: SelectEngine;
}

export class SelectMode extends InteractionMode {
  readonly id: Mode = "select";

  #select: SelectEngine;

  constructor(
    options: SelectModeOptions
  ) {
    super();
    this.#select = options.select;
  }

  onExit(): void {
    this.#select.clear();
  }

  cursor(): string {
    return this.#select.cursor;
  }

  onHover(
    position: Vec2 | null
  ): void {
    this.#select.hover(position);
  }

  onPointerDown(
    slot: BrushColorSlot,
    position: PointerPosition
  ): boolean {
    if (slot !== "primary") {
      return false;
    }

    this.#select.handleStart(position.texture, position.canvas);

    return true;
  }

  onPointerMove(
    slot: BrushColorSlot,
    position: PointerPosition
  ): void {
    if (slot === "primary") {
      this.#select.handleMove(position.texture, position.canvas);
    }
  }

  onPointerUp(
    slot: BrushColorSlot
  ): void {
    if (slot === "primary") {
      this.#select.handleEnd();
    }
  }

  onSelectAll(): boolean {
    return this.#select.selectAll();
  }

  onDelete(): boolean {
    return this.#select.delete();
  }

  onRotate(
    direction: RotationDirection
  ): boolean {
    return this.#select.rotate(direction);
  }

  onFlipHorizontal(): boolean {
    return this.#select.flipHorizontal();
  }

  onFlipVertical(): boolean {
    return this.#select.flipVertical();
  }
}
