// Import Internal Dependencies
import { InteractionMode } from "./InteractionMode.ts";
import type { PointerPosition } from "../InputActions.ts";
import type { BrushColorSlot } from "../../tools/Brush.ts";
import type { FillEngine } from "../../tools/FillEngine.ts";
import type {
  BrushHighlightView
} from "../../rendering/overlays/BrushHighlight.ts";
import type {
  Mode,
  Vec2
} from "../../types.ts";

function singlePixel(): number {
  return 1;
}

export interface FillModeOptions {
  fill: FillEngine;
  highlight: BrushHighlightView;
}

export class FillMode extends InteractionMode {
  readonly id: Mode = "fill";
  readonly writesPixels = true;

  #fill: FillEngine;
  #highlight: BrushHighlightView;

  constructor(
    options: FillModeOptions
  ) {
    super();
    this.#fill = options.fill;
    this.#highlight = options.highlight;
  }

  onExit(): void {
    this.#highlight.hide();
  }

  onPointerDown(
    slot: BrushColorSlot,
    position: PointerPosition
  ): boolean {
    this.#fill.run(
      position.texture.x,
      position.texture.y,
      slot
    );

    return false;
  }

  onHover(
    position: Vec2 | null
  ): void {
    this.#highlight.update(
      position?.x ?? null,
      position?.y ?? null,
      singlePixel
    );
  }
}
