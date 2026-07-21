// Import Internal Dependencies
import { InteractionMode } from "./InteractionMode.ts";
import type { UVController } from "../../uv/UVController.ts";
import type {
  Mode,
  Vec2
} from "../../types.ts";

export interface UVModeOptions {
  uv: UVController;
}

/**
 * Selects and drags UV regions.
 */
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
  }

  cursor(): string {
    return this.#uv.isDragging ? "grabbing" : "grab";
  }

  onPrimaryDown(
    pos: Vec2
  ): boolean | void {
    this.#uv.handleStart(pos);

    return true;
  }

  onPrimaryMove(
    pos: Vec2
  ): void {
    this.#uv.handleMove(pos);
  }

  onPrimaryUp(): void {
    this.#uv.handleEnd();
  }

  onDelete(): boolean | void {
    return this.#uv.handleDelete();
  }

  onBlur(): void {
    this.#uv.cancelDrag();
  }
}
