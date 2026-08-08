// Import Internal Dependencies
import { InteractionMode } from "./InteractionMode.ts";
import type { BrushController } from "../../tools/BrushController.ts";
import type { LineController } from "../../tools/LineController.ts";
import type {
  BrushHighlightOverlay
} from "../../rendering/overlays/BrushHighlightOverlay.ts";
import type {
  Mode,
  Vec2
} from "../../types.ts";

export interface PaintModeOptions {
  brush: BrushController;
  line: LineController;
  highlight: BrushHighlightOverlay;
  /** Cancels the active primary drag without committing it. */
  stopDrawing: () => void;
}

/**
 * Freehand brush strokes plus the Shift-armed straight line, in the primary or
 * secondary color.
 * Owns both the brush and line tools and the coordination between them.
 */
export class PaintMode extends InteractionMode {
  readonly id: Mode = "paint";

  #brush: BrushController;
  #line: LineController;
  #highlight: BrushHighlightOverlay;
  #stopDrawing: () => void;

  constructor(
    options: PaintModeOptions
  ) {
    super();
    this.#brush = options.brush;
    this.#line = options.line;
    this.#highlight = options.highlight;
    this.#stopDrawing = options.stopDrawing;
  }

  onExit(): void {
    this.#highlight.hide();
    this.#line.cancelIfArmed();
    this.#brush.pickArmed = false;
  }

  highlightSize(
    brushSize: number
  ): number {
    return this.#brush.pickArmed ? 1 : brushSize;
  }

  onPrimaryDown(
    pos: Vec2
  ): boolean | void {
    if (this.#brush.pickArmed) {
      this.#brush.pick(pos.x, pos.y);

      return false;
    }

    if (
      this.#line.isArmed &&
      this.#line.commitTrigger === "mousedown"
    ) {
      this.#line.commit("primary");

      return false;
    }

    if (this.#brush.isActive === "secondary") {
      return false;
    }

    this.#brush.startStroke(pos.x, pos.y, "primary");

    return true;
  }

  onPrimaryMove(
    pos: Vec2
  ): void {
    this.#brush.continueStroke(pos.x, pos.y);
  }

  onPrimaryUp(): void {
    this.#brush.endStroke();
  }

  onSecondaryDown(
    pos: Vec2,
    ctrlKey: boolean
  ): boolean | void {
    if (ctrlKey) {
      this.#brush.pick(pos.x, pos.y);

      return false;
    }

    if (
      this.#line.isArmed &&
      this.#line.commitTrigger === "mousedown"
    ) {
      this.#line.commit("secondary");

      return false;
    }

    if (this.#brush.isActive === "primary") {
      return false;
    }

    this.#brush.startStroke(pos.x, pos.y, "secondary");

    return true;
  }

  onSecondaryMove(
    pos: Vec2
  ): void {
    this.#brush.continueStroke(pos.x, pos.y);
  }

  onSecondaryUp(): void {
    this.#brush.endStroke();
  }

  onHover(
    cx: number,
    cy: number
  ): void {
    const outside = cx < 0 || cy < 0;
    this.#highlight.update(
      outside ? null : cx,
      outside ? null : cy
    );
  }

  onCursorMove(
    pos: Vec2 | null
  ): void {
    this.#line.updateCursor(pos);
  }

  onMouseUp(): void {
    if (
      this.#line.isArmed &&
      this.#line.commitTrigger === "mouseup"
    ) {
      this.#line.commit();
    }
  }

  onShiftDown(): void {
    this.#line.shiftHeld = true;

    if (this.#brush.isActive === "primary") {
      // A held pointer requires committing the line on mouseup.
      this.#stopDrawing();
      this.#brush.endStroke();
      this.#line.arm("mouseup");

      return;
    }

    if (this.#brush.isActive === "secondary") {
      // The line tool only ever draws in the primary color; let the
      // secondary-color drag keep painting uninterrupted.
      return;
    }

    this.#line.arm("mousedown");
  }

  onShiftUp(): void {
    this.#line.shiftHeld = false;
    this.#line.cancelIfArmed();
  }

  onBlur(): void {
    this.#line.shiftHeld = false;
    this.#line.cancelIfArmed();
  }
}
