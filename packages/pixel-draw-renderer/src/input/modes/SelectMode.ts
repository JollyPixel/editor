// Import Internal Dependencies
import { InteractionMode } from "./InteractionMode.ts";
import type { SelectController } from "../../tools/SelectController.ts";
import type {
  Mode,
  Vec2
} from "../../types.ts";

export interface SelectModeOptions {
  select: SelectController;
}

/**
 * Rectangular / magic-wand selection with move, copy, paste, delete, rotate and
 * flip.
 */
export class SelectMode extends InteractionMode {
  readonly id: Mode = "select";

  #select: SelectController;

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

  onCopy(): boolean {
    return this.#select.handleCopy();
  }

  onPaste(): boolean {
    return this.#select.handlePaste();
  }

  onDelete(): boolean {
    return this.#select.handleDelete();
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
