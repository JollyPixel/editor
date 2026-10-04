// Import Internal Dependencies
import { InteractionMode } from "./InteractionMode.ts";
import type { PointerPosition } from "../InputActions.ts";
import type {
  Brush,
  BrushColorSlot,
  BrushPaintSource
} from "../../tools/Brush.ts";
import type { BrushEngine } from "../../tools/BrushEngine.ts";
import type { LineEngine } from "../../tools/LineEngine.ts";
import type {
  BrushHighlightView
} from "../../rendering/overlays/BrushHighlight.ts";
import type {
  Mode,
  Vec2
} from "../../types.ts";

export interface StrokeModeOptions {
  id: Mode;
  erase: boolean;
  brush: Brush;
  engine: BrushEngine;
  line: LineEngine;
  highlight: BrushHighlightView;
}

export class StrokeMode extends InteractionMode {
  readonly id: Mode;
  readonly writesPixels = true;

  #erase: boolean;
  #brush: Brush;
  #engine: BrushEngine;
  #line: LineEngine;
  #highlight: BrushHighlightView;
  #highlightSize = (): number => this.highlightSize();

  constructor(
    options: StrokeModeOptions
  ) {
    super();
    this.id = options.id;
    this.#erase = options.erase;
    this.#brush = options.brush;
    this.#engine = options.engine;
    this.#line = options.line;
    this.#highlight = options.highlight;
  }

  highlightSize(): number {
    return this.#brush.size;
  }

  onExit(): void {
    this.#highlight.hide();
    this.#line.cancel();
  }

  onPointerDown(
    slot: BrushColorSlot,
    position: PointerPosition,
    _ctrlKey: boolean
  ): boolean {
    const source = this.#sourceFor(slot);
    if (this.#line.commitsOn("mousedown")) {
      this.#line.commit(source);

      return false;
    }

    this.#engine.startStroke(
      position.texture.x,
      position.texture.y,
      source
    );

    return true;
  }

  onPointerMove(
    _slot: BrushColorSlot,
    position: PointerPosition
  ): void {
    this.#engine.continueStroke(
      position.texture.x,
      position.texture.y
    );
  }

  onPointerUp(): void {
    this.#engine.endStroke();
  }

  onHover(
    position: Vec2 | null
  ): void {
    this.#highlight.update(
      position?.x ?? null,
      position?.y ?? null,
      this.#highlightSize
    );
  }

  onCursorMove(
    position: Vec2 | null
  ): void {
    this.#line.updateCursor(position);
  }

  onMouseUp(): void {
    if (this.#line.commitsOn("mouseup")) {
      this.#line.commit();
    }
  }

  onLineHeldChange(
    held: boolean
  ): void {
    if (!held) {
      this.#line.cancel();

      return;
    }

    const strokeSource = this.#engine.endStroke();
    if (strokeSource === null) {
      this.#line.arm("mousedown", this.#sourceFor("primary"));
    }
    else {
      this.#line.arm("mouseup", strokeSource);
    }
  }

  onCtrlWheel(
    delta: number
  ): boolean {
    if (delta === 0) {
      return false;
    }

    this.#brush.size -= Math.sign(delta);
    this.#highlight.refresh();

    return true;
  }

  onBlur(): void {
    this.#line.cancel();
  }

  #sourceFor(
    slot: BrushColorSlot
  ): BrushPaintSource {
    return this.#erase ? "erase" : slot;
  }
}
