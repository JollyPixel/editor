// Import Internal Dependencies
import { InteractionMode } from "./InteractionMode.ts";
import type { SelectEngine } from "../../tools/SelectEngine.ts";
import type {
  Mode,
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
    if (this.#select.isDragging) {
      return "grabbing";
    }

    return this.#select.hasSelection ? "grab" : "";
  }

  onPrimaryDown(
    pos: Vec2
  ): boolean {
    this.#select.handleStart(pos);

    return true;
  }

  onPrimaryMove(
    pos: Vec2
  ): void {
    this.#select.handleMove(pos);
  }

  onPrimaryUp(): void {
    this.#select.handleEnd();
  }

  onDelete(): boolean {
    return this.#select.delete();
  }

  onRotate(): boolean {
    return this.#select.rotate();
  }

  onFlipHorizontal(): boolean {
    return this.#select.flipHorizontal();
  }

  onFlipVertical(): boolean {
    return this.#select.flipVertical();
  }
}
