// Import Internal Dependencies
import { InteractionMode } from "./InteractionMode.ts";
import type { PointerPosition } from "../InputActions.ts";
import type { BrushColorSlot } from "../../tools/Brush.ts";
import type { UVController } from "../../tools/uv/UVController.ts";
import type {
  Mode,
  RotationDirection,
  Vec2
} from "../../types.ts";

export interface UVModeOptions {
  uv: UVController;
}

export class UVMode extends InteractionMode {
  readonly id: Mode = "uv";

  #uv: UVController;

  constructor(
    options: UVModeOptions
  ) {
    super();
    this.#uv = options.uv;
  }

  onExit(): void {
    this.#uv.cancelDrag();
    this.#uv.alignEdges(false);
  }

  cursor(): string {
    return this.#uv.cursor;
  }

  onHover(
    position: Vec2 | null
  ): void {
    this.#uv.hover(position);
  }

  onLineHeldChange(
    held: boolean
  ): void {
    this.#uv.alignEdges(held);
  }

  onPointerDown(
    slot: BrushColorSlot,
    position: PointerPosition
  ): boolean {
    if (slot !== "primary") {
      return false;
    }

    this.#uv.handleStart(position.canvas);

    return true;
  }

  onPointerMove(
    slot: BrushColorSlot,
    position: PointerPosition
  ): void {
    if (slot === "primary") {
      this.#uv.handleMove(position.canvas);
    }
  }

  onPointerUp(
    slot: BrushColorSlot
  ): void {
    if (slot === "primary") {
      this.#uv.handleEnd();
    }
  }

  onDelete(): boolean {
    return this.#uv.handleDelete();
  }

  onRotate(
    direction: RotationDirection
  ): boolean {
    return this.#uv.rotate(direction);
  }

  onBlur(): void {
    this.#uv.cancelDrag();
    this.#uv.alignEdges(false);
  }
}
