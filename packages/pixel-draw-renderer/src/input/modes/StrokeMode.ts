// Import Internal Dependencies
import { InteractionMode } from "./InteractionMode.ts";
import type {
  BrushEngine,
  BrushPaintMode
} from "../../tools/BrushEngine.ts";
import type { LineEngine } from "../../tools/LineEngine.ts";
import type {
  BrushHighlightView
} from "../../rendering/overlays/BrushHighlight.ts";
import type {
  Mode,
  Vec2
} from "../../types.ts";

export interface StrokeModeOptions {
  brush: BrushEngine;
  line: LineEngine;
  highlight: BrushHighlightView;
  stopDrawing: () => void;
}

export abstract class StrokeMode extends InteractionMode {
  abstract readonly id: Mode;

  #brush: BrushEngine;
  #line: LineEngine;
  #highlight: BrushHighlightView;
  #stopDrawing: () => void;
  #paintMode: BrushPaintMode;

  constructor(
    options: StrokeModeOptions,
    paintMode: BrushPaintMode = "brush"
  ) {
    super();
    this.#brush = options.brush;
    this.#line = options.line;
    this.#highlight = options.highlight;
    this.#stopDrawing = options.stopDrawing;
    this.#paintMode = paintMode;
  }

  #claimEngines(): void {
    this.#brush.paintMode = this.#paintMode;
    this.#line.paintMode = this.#paintMode;
  }

  onExit(): void {
    this.#highlight.hide();
    this.#line.cancelIfArmed();
    this.#brush.paintMode = "brush";
    this.#line.paintMode = "brush";
  }

  onPrimaryDown(
    pos: Vec2
  ): boolean {
    this.#claimEngines();

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

    this.#brush.startStroke(
      pos.x,
      pos.y,
      "primary"
    );

    return true;
  }

  onPrimaryMove(
    pos: Vec2
  ): void {
    this.#brush.continueStroke(
      pos.x,
      pos.y
    );
  }

  onPrimaryUp(): void {
    this.#brush.endStroke();
  }

  onSecondaryDown(
    pos: Vec2,
    _ctrlKey: boolean
  ): boolean {
    this.#claimEngines();

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

    this.#brush.startStroke(
      pos.x,
      pos.y,
      "secondary"
    );

    return true;
  }

  onSecondaryMove(
    pos: Vec2
  ): void {
    this.#brush.continueStroke(
      pos.x,
      pos.y
    );
  }

  onSecondaryUp(): void {
    this.#brush.endStroke();
  }

  onHover(
    position: Vec2 | null
  ): void {
    this.#highlight.update(
      position?.x ?? null,
      position?.y ?? null
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
    this.#claimEngines();
    this.#line.shiftHeld = true;

    if (this.#brush.isActive === "primary") {
      this.#stopDrawing();
      this.#brush.endStroke();
      this.#line.arm("mouseup");

      return;
    }

    if (this.#brush.isActive === "secondary") {
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
